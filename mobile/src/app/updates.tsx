import { useEffect, useState } from 'react';

import { BackHeader } from '@/components/Header';
import { EmptyState, Loading, Muted, Screen } from '@/components/ui';
import { UpdatesList, useUpdates } from '@/components/UpdatesFeed';
import { useActiveEvent } from '@/providers/EventProvider';

/** Todas as atualizações das corridas em que o corredor está associado */
export default function UpdatesScreen() {
  const { registrations } = useActiveEvent();
  const u = useUpdates(registrations, 100);
  const { loading, seenAt, markSeen } = u;
  // guarda o "visto até" de antes de abrir (para destacar o que é novo) e marca tudo como visto
  const [snapshot, setSnapshot] = useState<string | null>(null);
  useEffect(() => {
    if (loading || !seenAt || snapshot) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshot(seenAt);
    markSeen();
  }, [loading, seenAt, snapshot, markSeen]);

  if (u.loading) return <Loading />;
  return (
    <Screen refreshing={false} onRefresh={u.refresh} bottomInset={false}>
      <BackHeader title="Atualizações" />
      <Muted style={{ marginTop: -8, marginBottom: 12 }}>Tudo o que a organização adicionou ou mudou nas suas corridas.</Muted>
      {!u.items.length ? <EmptyState icon="notifications-outline" title="Nada por aqui ainda" message="Quando a organização publicar algo nas suas corridas, aparece aqui." /> : null}
      {u.items.length ? <UpdatesList items={u.items} seenAt={snapshot} registrations={registrations} /> : null}
    </Screen>
  );
}
