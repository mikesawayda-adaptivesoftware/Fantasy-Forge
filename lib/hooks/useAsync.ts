'use client';

import { useCallback, useEffect, useEffectEvent, useState } from 'react';

interface AsyncState<T> {
  key: string;
  data: T | null;
  error: Error | null;
}

/**
 * Load data for a key (null = don't load). Results for a previous key are
 * ignored, so switching leagues never flashes stale data.
 */
export function useAsync<T>(key: string | null, loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const load = useEffectEvent(loader);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load()
      .then(data => !cancelled && setState({ key, data, error: null }))
      .catch(error => !cancelled && setState({ key, data: null, error: error instanceof Error ? error : new Error(String(error)) }));
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt(a => a + 1), []);
  const current = key !== null && state?.key === key ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: key !== null && !current,
    reload,
  };
}
