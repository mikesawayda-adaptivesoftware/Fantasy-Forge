'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Keep page selections in the URL so views are shareable and survive reloads.
 * Returns the current values and a setter that merges updates (null removes).
 */
export function useQueryParams<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = Object.fromEntries(keys.map(key => [key, searchParams.get(key)])) as Record<K, string | null>;

  const setParams = useCallback(
    (updates: Partial<Record<K, string | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates) as [string, string | null | undefined][]) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return [values, setParams] as const;
}

/** Comma-separated list helpers for multi-select params */
export function parseIdList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}
