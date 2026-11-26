import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Card, GradientButton, Input, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/theme';
import { t } from '@/i18n';

const EXAMPLE = `codigo;nome;email;distancia;camiseta;cpf
NRS-2001;Maria Silva;maria@email.com;10K;M;12345678900
NRS-2002;João Souza;joao@email.com;21K;G;`;

/**
 * Importa compras de kit exportadas da plataforma de vendas (Sympla, Ticket Sports, etc.)
 * Também cria/atualiza os compradores como leads "qualificados".
 */
export default function ImportKits() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function onImport() {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return Alert.alert(t('Cole o cabeçalho + ao menos uma linha'));
    const sep = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].toLowerCase().split(sep).map((h) => h.trim());
    const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
    const col = {
      code: idx(['codigo', 'código', 'order_code', 'pedido']),
      name: idx(['nome', 'name', 'buyer_name']),
      email: idx(['email', 'e-mail']),
      distance: idx(['distancia', 'distância', 'distance', 'modalidade']),
      size: idx(['camiseta', 'tamanho', 'shirt_size']),
      doc: idx(['cpf', 'documento']),
    };
    if (col.code < 0) return Alert.alert(t('Coluna "codigo" não encontrada no cabeçalho'));

    setBusy(true);
    try {
      const distances = await api.distances(eventId);
      const byLabel = new Map(distances.map((d) => [d.label.toLowerCase(), d.id]));
      const rows = lines.slice(1).map((l) => {
        const c = l.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
        const get = (i: number) => (i >= 0 ? c[i] || null : null);
        return {
          event_id: eventId,
          order_code: get(col.code)!,
          buyer_name: get(col.name),
          buyer_email: get(col.email)?.toLowerCase() ?? null,
          distance_id: byLabel.get((get(col.distance) ?? '').toLowerCase()) ?? null,
          shirt_size: get(col.size)?.toUpperCase() ?? null,
          buyer_document: get(col.doc),
        };
      }).filter((r) => r.order_code);

      const { error } = await supabase.from('st_kit_purchases').upsert(rows, { onConflict: 'event_id,order_code' });
      if (error) throw error;

      // Compradores viram leads qualificados (para campanhas de upsell / patrocinadores)
      const leads = rows.filter((r) => r.buyer_email).map((r) => ({
        event_id: eventId,
        name: r.buyer_name ?? r.buyer_email!,
        email: r.buyer_email,
        source: 'import' as const,
        status: 'qualified' as const,
        score: 80,
        interest: distances.find((d) => d.id === r.distance_id)?.label ?? null,
        consent_marketing: true,
      }));
      for (const l of leads) await supabase.from('st_leads').insert(l); // ignora duplicados (índice único)

      Alert.alert(t('Importação concluída ✓'), t('{n} compras importadas. Os participantes já podem vincular pelo código.', { n: rows.length }));
      router.back();
    } catch (e) {
      Alert.alert(t('Erro'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bottomInset={false}>
      <BackHeader title="Importar compras de kit" />
      <Muted style={{ marginBottom: 12 }}>
        {t('Exporte a planilha da sua plataforma de vendas e cole abaixo (CSV separado por ; ou ,). O participante usa o código do pedido para vincular a inscrição no app.')}
      </Muted>
      <Card animated={false}>
        <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 6 }]}>{t('Exemplo')}</Text>
        <Text style={{ color: colors.lime, fontFamily: 'monospace', fontSize: 11 }}>{EXAMPLE}</Text>
      </Card>
      <Input multiline value={text} onChangeText={setText} placeholder="Cole aqui..." autoCapitalize="none" style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <GradientButton title="Usar exemplo" variant="ghost" small onPress={() => setText(EXAMPLE)} style={{ flex: 1 }} />
        <GradientButton title="Importar" icon="cloud-upload" small onPress={onImport} loading={busy} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
