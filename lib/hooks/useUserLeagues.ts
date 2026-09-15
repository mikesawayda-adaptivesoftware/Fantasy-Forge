'use client';

import { useCallback, useEffect, useState } from 'react';
import { SleeperLeague, SleeperRoster, SleeperUser } from '@/types';
import { api } from '@/lib/api';
import { getLeagueRosters, getUserByUsername, getUserLeagues } from '@/lib/sleeper';
import { useSavedUsername } from './useSavedUsername';

interface LeagueList {
  username: string;
  user: SleeperUser | null;
  leagues: SleeperLeague[];
}

/**
 * The saved Sleeper user and their leagues for the current league season.
 * In-season leagues are preferred; otherwise any league that isn't complete.
 */
export function useUserLeagues(options: { includeAll?: boolean } = {}) {
  const { includeAll = false } = options;
  const username = useSavedUsername();
  const [list, setList] = useState<LeagueList | null>(null);
  const [error, setError] = useState<{ username: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      const [user, state] = await Promise.all([getUserByUsername(username), api.state()]);
      const leagues = user ? await getUserLeagues(user.user_id, state.league_season) : [];
      if (cancelled) return;
      setList({ username, user, leagues });
      setError(null);
    })().catch(() => !cancelled && setError({ username, message: 'Failed to load your leagues' }));
    return () => {
      cancelled = true;
    };
  }, [username, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  const current = username && list?.username === username ? list : null;
  const all = current?.leagues ?? [];
  const active = all.filter(l => l.status === 'in_season');
  const leagues = includeAll ? all : active.length ? active : all.filter(l => l.status !== 'complete');

  return {
    username,
    user: current?.user ?? null,
    leagues,
    loading: !!username && !current && error?.username !== username,
    error: error?.username === username ? error.message : null,
    retry,
  };
}

/** Rosters for a league, keyed so stale results from another league are ignored */
export function useLeagueRosters(leagueId: string | null) {
  const [state, setState] = useState<{ leagueId: string; rosters: SleeperRoster[] | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    getLeagueRosters(leagueId)
      .then(rosters => !cancelled && setState({ leagueId, rosters, error: null }))
      .catch(() => !cancelled && setState({ leagueId, rosters: null, error: 'Failed to load league rosters' }));
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const current = leagueId && state?.leagueId === leagueId ? state : null;
  return { rosters: current?.rosters ?? null, error: current?.error ?? null, loading: !!leagueId && !current };
}

export function findUserRoster(rosters: SleeperRoster[] | null | undefined, userId: string | null | undefined): SleeperRoster | null {
  if (!rosters || !userId) return null;
  return rosters.find(r => r.owner_id === userId || r.co_owners?.includes(userId)) ?? null;
}
