'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach(listener => listener());
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, blocked) – keep going
  }
  notify(key);
}

/**
 * Subscribe to a localStorage key. Renders `null` on the server and during
 * hydration, then the stored value.
 */
export function useLocalStorageValue(key: string): string | null {
  return useSyncExternalStore(
    callback => {
      const set = listeners.get(key) ?? new Set();
      set.add(callback);
      listeners.set(key, set);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) callback();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        set.delete(callback);
        window.removeEventListener('storage', onStorage);
      };
    },
    () => read(key),
    () => null
  );
}

/** True once the component is hydrated on the client */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
