/**
 * Browser data access with a small in-memory cache so navigating between
 * pages doesn't re-download the same data. Concurrent requests are shared.
 */
import { NflState, Player, StatsByPlayer, TeamSchedule, TrendingPlayer, WeeklyStatsPayload } from '@/types';
import type { DefenseVsPositionResponse } from './matchups';

interface ClientCacheEntry {
  promise: Promise<unknown>;
  expires: number;
}

const clientCache = new Map<string, ClientCacheEntry>();

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, ttlMs = 5 * 60_000): Promise<T> {
  const now = Date.now();
  const hit = clientCache.get(url);
  if (hit && hit.expires > now) return hit.promise as Promise<T>;

  const promise = fetch(url).then(async response => {
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        // non-JSON error body
      }
      throw new ApiError(message, response.status);
    }
    return response.json() as Promise<T>;
  });

  clientCache.set(url, { promise, expires: now + ttlMs });
  promise.catch(() => clientCache.delete(url));
  return promise;
}

const MINUTE = 60_000;

export const api = {
  state: () => fetchJson<NflState>('/api/nfl/state', 5 * MINUTE),
  players: () => fetchJson<Player[]>('/api/nfl/players', 10 * MINUTE),
  schedule: (season: string) => fetchJson<TeamSchedule>(`/api/nfl/schedule/${season}`, 30_000),
  stats: (season: string, week: number, idp = false) =>
    fetchJson<WeeklyStatsPayload>(`/api/nfl/weekly/stats/${season}/${week}${idp ? '?idp=1' : ''}`, 2 * MINUTE),
  projections: (season: string, week: number, idp = false) =>
    fetchJson<StatsByPlayer>(`/api/nfl/weekly/projections/${season}/${week}${idp ? '?idp=1' : ''}`, 5 * MINUTE),
  defense: () => fetchJson<DefenseVsPositionResponse>('/api/nfl/defense', 30 * MINUTE),
  trending: (type: 'add' | 'drop' = 'add', hours = 24, limit = 50) =>
    fetchJson<TrendingPlayer[]>(`/api/nfl/trending?type=${type}&hours=${hours}&limit=${limit}`, 10 * MINUTE),
};
