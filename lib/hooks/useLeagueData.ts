'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NflState, SleeperLeague, SleeperLeagueUser, SleeperMatchup, SleeperRoster, SleeperUser } from '@/types';
import { api } from '@/lib/api';
import { getLeague, getLeagueMatchups, getLeagueRosters, getLeagueUsers, getUserByUsername } from '@/lib/sleeper';
import { resolveSeasonContext } from '@/lib/nfl';
import { useSavedUsername } from './useSavedUsername';

interface RawLeagueData {
  leagueId: string;
  state: NflState;
  week: number;
  league: SleeperLeague;
  rosters: SleeperRoster[];
  users: SleeperLeagueUser[];
  matchups: SleeperMatchup[];
}

interface UserLookup {
  username: string;
  user: SleeperUser | null;
  error: Error | null;
}

async function loadLeague(leagueId: string): Promise<RawLeagueData> {
  const state = await api.state();
  const { week } = resolveSeasonContext(state);
  const [league, rosters, users, matchups] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getLeagueMatchups(leagueId, week).catch(() => []),
  ]);
  if (!league) throw new Error('League not found');
  return { leagueId, state, week, league, rosters, users, matchups };
}

/** League, rosters, members and this week's matchups, plus the signed-in user's team */
export function useLeagueData(leagueId: string, options: { refreshMs?: number } = {}) {
  const { refreshMs } = options;
  const username = useSavedUsername();
  const [raw, setRaw] = useState<RawLeagueData | null>(null);
  const [lookup, setLookup] = useState<UserLookup | null>(null);
  const [error, setError] = useState<{ leagueId: string; error: Error } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadLeague(leagueId)
      .then(data => {
        if (cancelled) return;
        setRaw(data);
        setError(null);
      })
      .catch(err => !cancelled && setError({ leagueId, error: err instanceof Error ? err : new Error('Failed to load league') }));
    return () => {
      cancelled = true;
    };
  }, [leagueId, attempt]);

  // Keep live scores and lineups current without flashing a loading state
  useEffect(() => {
    if (!refreshMs) return;
    let cancelled = false;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadLeague(leagueId)
        .then(data => !cancelled && setRaw(data))
        .catch(() => undefined);
    }, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [leagueId, refreshMs]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    getUserByUsername(username)
      .then(user => !cancelled && setLookup({ username, user, error: null }))
      .catch(err => !cancelled && setLookup({ username, user: null, error: err instanceof Error ? err : new Error('Failed to load your Sleeper account') }));
    return () => {
      cancelled = true;
    };
  }, [username, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setRaw(null);
    setLookup(null);
    setAttempt(a => a + 1);
  }, []);

  // Ignore results that belong to a previous league/username
  const current = raw?.leagueId === leagueId ? raw : null;
  const currentError = error?.leagueId === leagueId ? error.error : null;
  const currentLookup = username && lookup?.username === username ? lookup : null;
  const user = currentLookup?.user ?? null;
  const userPending = !!username && !currentLookup;

  const derived = useMemo(() => {
    if (!current) return null;
    const usersById = new Map(current.users.map(u => [u.user_id, u]));
    const userRoster = user
      ? current.rosters.find(r => r.owner_id === user.user_id || r.co_owners?.includes(user.user_id)) ?? null
      : null;
    const userMatchup = userRoster ? current.matchups.find(m => m.roster_id === userRoster.roster_id) ?? null : null;
    const opponentMatchup =
      userMatchup && userMatchup.matchup_id !== null
        ? current.matchups.find(m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userMatchup.roster_id) ?? null
        : null;
    const opponentRoster = opponentMatchup ? current.rosters.find(r => r.roster_id === opponentMatchup.roster_id) ?? null : null;
    const ownerOf = (roster: SleeperRoster | null | undefined) => (roster?.owner_id ? usersById.get(roster.owner_id) ?? null : null);
    return { usersById, userRoster, userMatchup, opponentMatchup, opponentRoster, ownerOf };
  }, [current, user]);

  return {
    loading: (!current && !currentError) || userPending,
    error: currentError ?? currentLookup?.error ?? null,
    retry,
    username,
    user,
    week: current?.week ?? null,
    league: current?.league ?? null,
    rosters: current?.rosters ?? [],
    users: current?.users ?? [],
    matchups: current?.matchups ?? [],
    ...derived,
  };
}

export type LeagueData = ReturnType<typeof useLeagueData>;
