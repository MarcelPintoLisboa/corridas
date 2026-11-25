import { useCallback, useEffect, useRef, useState } from 'react';

/** Hook simples de carregamento com refresh (pull-to-refresh) */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (isRefresh = false) => {
    await Promise.resolve(); // evita setState síncrono dentro do effect
    if (isRefresh) setRefreshing(true);
    try {
      setError(null);
      setData(await fnRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // busca de dados ao montar: o setState só ocorre após o await em run()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, refreshing, error, reload: () => run(false), refresh: () => run(true) };
}
