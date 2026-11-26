import type { IconName } from '@/components/ui';
import { formatDate, formatDateTime, formatTime, sessionTypeMeta, tipCategoryLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';

import type { Field, Option } from './form';
import { t } from '@/i18n';

type Row = Record<string, any>;

export interface Resource {
  key: string;
  table: string;
  title: string;
  icon: IconName;
  description: string;
  parentKey: 'event_id' | 'plan_id';
  order: { column: string; ascending: boolean }[];
  fields: Field[];
  /** opções carregadas do banco (ex.: distâncias do evento) */
  loadOptions?: (parentId: string) => Promise<Record<string, Option[]>>;
  display: (r: Row) => { title: string; subtitle?: string; image?: string | null; badge?: string };
  rowAction?: { label: string; icon: IconName; href: (r: Row) => string };
  showInMenu?: boolean;
}

const distanceOptions = async (eventId: string) => {
  const { data } = await supabase.from('st_event_distances').select('id,label').eq('event_id', eventId).order('sort_order');
  return { distance_id: (data ?? []).map((d) => ({ label: d.label as string, value: d.id as string })) };
};

const levelOptions: Option[] = [
  { label: 'Iniciante', value: 'beginner' },
  { label: 'Intermediário', value: 'intermediate' },
  { label: 'Avançado', value: 'advanced' },
];

export const resources: Record<string, Resource> = {
  posts: {
    key: 'posts',
    table: 'st_posts',
    title: 'Publicações',
    icon: 'megaphone',
    description: 'Notícias, avisos, promoções e programação',
    parentKey: 'event_id',
    order: [{ column: 'pinned', ascending: false }, { column: 'published_at', ascending: false }],
    fields: [
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'news', options: [
        { label: 'Notícia', value: 'news' }, { label: 'Aviso', value: 'alert' }, { label: 'Promoção', value: 'promo' }, { label: 'Programação', value: 'schedule' },
      ] },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'body', label: 'Texto', type: 'multiline' },
      { key: 'image_url', label: 'Imagem', type: 'image', aspect: [16, 9] },
      { key: 'cta_label', label: 'Texto do botão', type: 'text', placeholder: 'Saiba mais' },
      { key: 'cta_url', label: 'Link do botão', type: 'url' },
      { key: 'pinned', label: 'Fixar no topo', type: 'bool' },
      { key: 'published', label: 'Publicado', type: 'bool', default: true },
      { key: 'published_at', label: 'Data de publicação', timeLabel: 'Hora', type: 'datetime', help: 'Agende para o futuro' },
    ],
    display: (r) => ({ title: r.title, subtitle: `${r.published ? '' : `🔒 ${t('Rascunho')} · `}${formatDateTime(r.published_at)}`, image: r.image_url, badge: r.pinned ? '📌' : undefined }),
  },

  sponsors: {
    key: 'sponsors',
    table: 'st_sponsors',
    title: 'Patrocinadores',
    icon: 'diamond',
    description: 'Banners, cotas, cupons e links',
    parentKey: 'event_id',
    order: [{ column: 'sort_order', ascending: true }],
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'tier', label: 'Cota', type: 'select', required: true, default: 'support', options: [
        { label: 'Master', value: 'master' }, { label: 'Ouro', value: 'gold' }, { label: 'Prata', value: 'silver' }, { label: 'Apoio', value: 'support' },
      ] },
      { key: 'logo_url', label: 'Logo', type: 'image', aspect: [1, 1] },
      { key: 'banner_url', label: 'Banner (carrossel)', type: 'image', aspect: [16, 9] },
      { key: 'description', label: 'Descrição', type: 'multiline' },
      { key: 'offer_title', label: 'Oferta para inscritos', type: 'text', placeholder: '20% OFF em tênis' },
      { key: 'coupon_code', label: 'Cupom', type: 'text' },
      { key: 'website_url', label: 'Site', type: 'url' },
      { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@marca' },
      { key: 'material_label', label: 'Material para os corredores (título)', type: 'text', placeholder: 'Guia de tênis, catálogo, vídeo…' },
      { key: 'material_url', label: 'Link do material (PDF, vídeo, catálogo)', type: 'url' },
      { key: 'sort_order', label: 'Ordem', type: 'number', default: 0 },
      { key: 'active', label: 'Ativo', type: 'bool', default: true },
    ],
    display: (r) => ({ title: r.name, subtitle: [r.tier?.toUpperCase(), r.offer_title, r.active ? null : t('inativo')].filter(Boolean).join(' · '), image: r.logo_url }),
    rowAction: { label: 'Métricas', icon: 'analytics', href: (r) => `/admin/sponsor/${r.id}` },
  },

  pickups: {
    key: 'pickups',
    table: 'st_kit_pickups',
    title: 'Retirada de kits',
    icon: 'cube',
    description: 'Locais, datas e horários',
    parentKey: 'event_id',
    order: [{ column: 'starts_at', ascending: true }],
    fields: [
      { key: 'location_name', label: 'Local', type: 'text', required: true },
      { key: 'address', label: 'Endereço', type: 'text' },
      { key: 'maps_url', label: 'Link do mapa', type: 'url' },
      { key: 'starts_at', label: 'Data de início', timeLabel: 'Hora de início', type: 'datetime', required: true },
      { key: 'ends_at', label: 'Data de término', timeLabel: 'Hora de término', type: 'datetime', required: true },
      { key: 'required_docs', label: 'Documentos necessários', type: 'text' },
      { key: 'notes', label: 'Observações', type: 'multiline' },
    ],
    display: (r) => ({ title: r.location_name, subtitle: `${formatDate(r.starts_at, true)} · ${formatTime(r.starts_at)}–${formatTime(r.ends_at)}` }),
  },

  distances: {
    key: 'distances',
    table: 'st_event_distances',
    title: 'Distâncias',
    icon: 'trail-sign',
    description: 'Percursos da prova',
    parentKey: 'event_id',
    order: [{ column: 'sort_order', ascending: true }],
    fields: [
      { key: 'label', label: 'Nome', type: 'text', required: true, placeholder: '10K' },
      { key: 'distance_km', label: 'Distância (km)', type: 'number', required: true },
      { key: 'start_time', label: 'Data da largada', timeLabel: 'Hora da largada', type: 'datetime' },
      { key: 'max_participants', label: 'Vagas', type: 'number' },
      { key: 'sort_order', label: 'Ordem', type: 'number', default: 0 },
    ],
    display: (r) => ({ title: r.label, subtitle: `${r.distance_km} km${r.start_time ? ` · ${t('largada')} ${formatTime(r.start_time)}` : ''}` }),
  },

  tips: {
    key: 'tips',
    table: 'st_tips',
    title: 'Dicas',
    icon: 'bulb',
    description: 'Treinadores, alimentação, hidratação',
    parentKey: 'event_id',
    order: [{ column: 'created_at', ascending: false }],
    fields: [
      { key: 'category', label: 'Categoria', type: 'select', required: true, default: 'training', options: Object.entries(tipCategoryLabel).map(([value, v]) => ({ value, label: `${v.emoji} ${v.label}` })) },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'body', label: 'Conteúdo', type: 'multiline', required: true },
      { key: 'author_name', label: 'Autor', type: 'text' },
      { key: 'author_role', label: 'Cargo do autor', type: 'text', placeholder: 'Nutricionista esportiva' },
      { key: 'image_url', label: 'Imagem', type: 'image', aspect: [16, 9] },
      { key: 'days_before_race', label: 'Liberar X dias antes da prova', type: 'number', help: 'Vazio = sempre visível' },
      { key: 'published', label: 'Publicada', type: 'bool', default: true },
    ],
    display: (r) => ({ title: r.title, subtitle: `${tipCategoryLabel[r.category]?.label}${r.days_before_race ? ` · ${t('libera D-{n}', { n: r.days_before_race })}` : ''}`, image: r.image_url }),
  },

  plans: {
    key: 'plans',
    table: 'st_training_plans',
    title: 'Planos de treino',
    icon: 'barbell',
    description: 'Planos por distância e nível',
    parentKey: 'event_id',
    order: [{ column: 'name', ascending: true }],
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'distance_id', label: 'Distância', type: 'select' },
      { key: 'level', label: 'Nível', type: 'select', required: true, default: 'beginner', options: levelOptions },
      { key: 'weeks', label: 'Semanas', type: 'number', required: true, default: 8 },
      { key: 'description', label: 'Descrição', type: 'multiline' },
      { key: 'coach_name', label: 'Treinador(a)', type: 'text' },
      { key: 'coach_avatar_url', label: 'Foto do treinador', type: 'image', aspect: [1, 1] },
    ],
    loadOptions: distanceOptions,
    display: (r) => ({ title: r.name, subtitle: `${t('{n} semanas', { n: r.weeks })} · ${r.coach_name ?? t('sem treinador')}` }),
    rowAction: { label: 'Sessões', icon: 'list', href: (r) => `/admin/crud/sessions?parentId=${r.id}` },
  },

  sessions: {
    key: 'sessions',
    table: 'st_training_sessions',
    title: 'Sessões do plano',
    icon: 'list',
    description: '',
    parentKey: 'plan_id',
    showInMenu: false,
    order: [{ column: 'week', ascending: true }, { column: 'day_of_week', ascending: true }],
    fields: [
      { key: 'week', label: 'Semana', type: 'number', required: true },
      { key: 'day_of_week', label: 'Dia', type: 'select', required: true, options: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((l, i) => ({ label: l, value: String(i + 1) })) },
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'easy', options: Object.entries(sessionTypeMeta).map(([value, v]) => ({ value, label: v.label })) },
      { key: 'description', label: 'Resumo (aparece abaixo do título)', type: 'multiline', placeholder: 'Corrida leve' },
      { key: 'distance_km', label: 'Distância total (km)', type: 'number' },
      { key: 'duration_min', label: 'Duração mínima (min)', type: 'number' },
      { key: 'duration_max_min', label: 'Duração máxima (min)', type: 'number', help: 'Com a mínima, mostra a faixa (ex.: 35–40 min)' },
      { key: 'target_pace', label: 'Pace alvo', type: 'text', placeholder: '5:30-6:00' },
      { key: 'warmup', label: 'Aquecimento', type: 'multiline', placeholder: 'Vazio = aquecimento padrão do tipo de treino' },
      { key: 'steps', label: 'Etapas do treino', type: 'steps' },
      { key: 'treadmill_notes', label: 'Instruções para esteira', type: 'multiline', placeholder: 'Ex.: inclinação de 1% para simular a rua' },
    ],
    display: (r) => ({
      title: `${t('S')}${r.week} · ${t(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][r.day_of_week - 1])} — ${r.title}`,
      subtitle: [
        sessionTypeMeta[r.type]?.label,
        r.distance_km ? `${r.distance_km} km` : null,
        r.target_pace,
        Array.isArray(r.steps) && r.steps.length ? t('{n} etapas', { n: r.steps.length }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
  },

  kits: {
    key: 'kits',
    table: 'st_kit_purchases',
    title: 'Compras de kit',
    icon: 'ticket',
    description: 'Códigos de pedido para vincular inscrições',
    parentKey: 'event_id',
    order: [{ column: 'created_at', ascending: false }],
    fields: [
      { key: 'order_code', label: 'Código do pedido', type: 'text', required: true },
      { key: 'buyer_name', label: 'Comprador', type: 'text' },
      { key: 'buyer_email', label: 'E-mail', type: 'text' },
      { key: 'buyer_document', label: 'CPF', type: 'text' },
      { key: 'distance_id', label: 'Distância', type: 'select' },
      { key: 'shirt_size', label: 'Camiseta', type: 'select', options: ['PP', 'P', 'M', 'G', 'GG', 'XG'].map((s) => ({ label: s, value: s })) },
      { key: 'kit_type', label: 'Tipo de kit', type: 'text', default: 'standard' },
    ],
    loadOptions: distanceOptions,
    display: (r) => ({ title: `${r.order_code} — ${r.buyer_name ?? ''}`, subtitle: `${r.buyer_email ?? ''} · ${r.claimed_by ? `✅ ${t('vinculado')}` : `⏳ ${t('aguardando app')}`}` }),
  },
};

export const eventFields: Field[] = [
  { key: 'name', label: 'Nome da corrida', type: 'text', required: true },
  { key: 'tagline', label: 'Slogan', type: 'text' },
  { key: 'description', label: 'Descrição', type: 'multiline' },
  { key: 'cover_image_url', label: 'Imagem de capa', type: 'image', aspect: [16, 9] },
  { key: 'logo_url', label: 'Logo', type: 'image', aspect: [1, 1] },
  { key: 'primary_color', label: 'Cor principal', type: 'color', default: '#FF4D2E' },
  { key: 'secondary_color', label: 'Cor secundária', type: 'color', default: '#7B2FF7' },
  { key: 'event_date', label: 'Data da corrida', timeLabel: 'Hora da largada', type: 'datetime', required: true },
  { key: 'acesso_horas_apos', label: 'Acesso dos corredores após a largada (horas)', type: 'number', default: 24, help: 'Depois desse prazo a corrida fecha para os corredores (os treinos continuam deles). Vazio = nunca fecha.' },
  { key: 'location_name', label: 'Local', type: 'text' },
  { key: 'address', label: 'Endereço', type: 'text' },
  { key: 'city', label: 'Cidade', type: 'text' },
  { key: 'state', label: 'UF', type: 'text' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'hashtag', label: 'Hashtag oficial', type: 'text', placeholder: '#MinhaCorrida' },
  { key: 'instagram_handle', label: 'Instagram', type: 'text', placeholder: '@minhacorrida' },
  { key: 'website_url', label: 'Site', type: 'url' },
  { key: 'registration_url', label: 'Link de inscrição', type: 'url' },
  { key: 'regulation_url', label: 'Regulamento (link)', type: 'url' },
  { key: 'route_map_url', label: 'Mapa do percurso', type: 'image', aspect: [4, 3] },
  { key: 'require_order_code', label: 'Exigir código do kit', type: 'bool', help: 'Só quem comprou o kit consegue se vincular' },
  { key: 'status', label: 'Status', type: 'select', required: true, default: 'draft', options: [
    { label: 'Rascunho', value: 'draft' }, { label: 'Publicado', value: 'published' }, { label: 'Finalizado', value: 'finished' }, { label: 'Cancelado', value: 'canceled' },
  ] },
];
