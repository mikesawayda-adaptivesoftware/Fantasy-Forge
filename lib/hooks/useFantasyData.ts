'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NflState, Player, PlayerWithStats, StatsByPlayer, TeamSchedule } from '@/types';
import { api } from '@/lib/api';
import { resolveSeasonContext, SeasonContext } from '@/lib/nfl';
import { calcPoints, describeScoring, SCORING_PRESETS, ScoringSettings } from '@/lib/points';
import { buildPlayerSeasons, computePositionRanks, WeekStats, withStats } from '@/lib/season';
import { computeDefenseVsPositionForScoring, DefenseVsPositionResponse, getMatchupInfo, getUpcomingMatchups, MatchupInfo } from '@/lib/matchups';
import { isListedPlayer } from '@/lib/scoring';
import { useScoringFormat } from './useScoringFormat';

interface RawFantasyData {
  state: NflState;
  ctx: SeasonContext;
  players: Player[];
  schedule: TeamSchedule | null;
  statsSchedule: TeamSchedule | null;
  projections: StatsByPlayer;
  weeks: WeekStats[];
  defense: DefenseVsPositionResponse | null;
}

export interface FantasyDataOptions {
  /** League scoring settings. Defaults to the user's selected format. */
  scoring?: ScoringSettings;
  /** Load weekly stats to build game logs/averages (default true) */
  includeSeason?: boolean;
  /** Load defense-vs-position matchup data (default true) */
  includeDefense?: boolean;
  /** Also load IDP stats and projections (IDP leagues) */
  includeIdp?: boolean;
  /** Re-fetch in the background (e.g. for live game days). Cached responses make this cheap. */
  refreshMs?: number;
}

interface LoadOptions {
  includeSeason: boolean;
  includeDefense: boolean;
  includeIdp: boolean;
}

async function loadWeek(season: string, week: number, includeIdp: boolean): Promise<WeekStats | null> {
  try {
    const [offense, idp] = await Promise.all([
      api.stats(season, week),
      includeIdp ? api.stats(season, week, true).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      week,
      stats: idp ? { ...offense.stats, ...idp.stats } : offense.stats,
      teams: idp ? { ...offense.teams, ...idp.teams } : offense.teams,
    };
  } catch {
    return null;
  }
}

async function loadFantasyData({ includeSeason, includeDefense, includeIdp }: LoadOptions): Promise<RawFantasyData> {
  const state = await api.state();
  const ctx = resolveSeasonContext(state);
  const weekNumbers = includeSeason ? Array.from({ length: ctx.statsThroughWeek }, (_, i) => i + 1) : [];

  const [players, schedule, projections, idpProjections, weeks, defense] = await Promise.all([
    api.players(),
    api.schedule(ctx.season).catch(() => null),
    api.projections(ctx.season, ctx.week).catch(() => ({} as StatsByPlayer)),
    includeIdp ? api.projections(ctx.season, ctx.week, true).catch(() => ({} as StatsByPlayer)) : Promise.resolve({} as StatsByPlayer),
    Promise.all(weekNumbers.map(week => loadWeek(ctx.statsSeason, week, includeIdp))),
    includeDefense ? api.defense().catch(() => null) : Promise.resolve(null),
  ]);

  return {
    state,
    ctx,
    players,
    schedule,
    // Game completion uses the current season's schedule; past-season logs use
    // the per-week team/opponent that comes with the stats instead.
    statsSchedule: ctx.statsSeason === ctx.season ? schedule : null,
    projections: { ...projections, ...idpProjections },
    weeks: weeks.filter((w): w is WeekStats => w !== null),
    defense,
  };
}

/**
 * Shared NFL data for every page: players, current week, schedule,
 * projections, season game logs and matchup ratings – all scored with either
 * the user's preferred format or a league's scoring settings.
 */
export function useFantasyData(options: FantasyDataOptions = {}) {
  const { includeSeason = true, includeDefense = true, includeIdp = false, refreshMs } = options;
  const format = useScoringFormat();
  const scoring = options.scoring ?? SCORING_PRESETS[format];

  const [raw, setRaw] = useState<RawFantasyData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadFantasyData({ includeSeason, includeDefense, includeIdp })
      .then(data => {
        if (!cancelled) {
          setRaw(data);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed to load data'));
      });
    return () => {
      cancelled = true;
    };
  }, [includeSeason, includeDefense, includeIdp, attempt]);

  // Background refresh keeps game status, live stats and projections current
  useEffect(() => {
    if (!refreshMs) return;
    let cancelled = false;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadFantasyData({ includeSeason, includeDefense, includeIdp })
        .then(data => !cancelled && setRaw(data))
        .catch(() => undefined); // keep showing the last good data
    }, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshMs, includeSeason, includeDefense, includeIdp]);

  const retry = useCallback(() => {
    setError(null);
    setRaw(null);
    setAttempt(a => a + 1);
  }, []);

  const playersById = useMemo(() => new Map((raw?.players ?? []).map(p => [p.id, p])), [raw]);
  const listedPlayers = useMemo(() => (raw?.players ?? []).filter(isListedPlayer), [raw]);

  const seasons = useMemo(
    () =>
      raw
        ? buildPlayerSeasons({ weeks: raw.weeks, scoring, playersById, schedule: raw.statsSchedule })
        : new Map(),
    [raw, scoring, playersById]
  );

  const projected = useMemo(() => {
    const map = new Map<string, number>();
    if (!raw) return map;
    for (const id in raw.projections) {
      map.set(id, calcPoints(raw.projections[id], scoring));
    }
    return map;
  }, [raw, scoring]);

  // Matchup ratings in the active scoring system (falls back to Sleeper's PPR ratings)
  const dvp = useMemo(() => {
    if (!raw) return null;
    const serverTeams = raw.defense?.teams ?? null;
    const weeksWithTeams = raw.weeks.filter(w => w.teams && Object.keys(w.teams).length > 0);
    if (weeksWithTeams.length === 0) return serverTeams;
    const sameSeason = raw.ctx.statsSeason === raw.ctx.season;
    return (
      computeDefenseVsPositionForScoring({
        weeks: weeksWithTeams.map(w => ({ week: w.week, stats: w.stats, teams: w.teams! })),
        scoring,
        positionOf: id => playersById.get(id)?.position,
        schedule: raw.statsSchedule,
        prior: sameSeason ? raw.defense?.previousTeams ?? null : null,
        priorGames: raw.defense?.priorGames ?? 3,
      }) ?? serverTeams
    );
  }, [raw, scoring, playersById]);

  const positionRanks = useMemo(() => computePositionRanks(raw?.players ?? [], seasons), [raw, seasons]);

  const getPlayerWithStats = useCallback(
    (id: string): PlayerWithStats | null => {
      const player = playersById.get(id);
      if (!player) return null;
      return withStats(player, seasons.get(id), projected.get(id) ?? 0);
    },
    [playersById, seasons, projected]
  );

  const getMatchup = useCallback(
    (player: Pick<Player, 'position' | 'team'>, week?: number): MatchupInfo | undefined => {
      if (!raw) return undefined;
      return getMatchupInfo({
        position: player.position,
        team: player.team,
        week: week ?? raw.ctx.week,
        schedule: raw.schedule,
        dvp,
      });
    },
    [raw, dvp]
  );

  const getUpcoming = useCallback(
    (player: Pick<Player, 'position' | 'team'>, count = 4, fromWeek?: number): MatchupInfo[] => {
      if (!raw) return [];
      return getUpcomingMatchups({
        position: player.position,
        team: player.team,
        fromWeek: fromWeek ?? raw.ctx.week,
        count,
        schedule: raw.schedule,
        dvp,
      });
    },
    [raw, dvp]
  );

  return {
    loading: !raw && !error,
    error,
    retry,
    ready: !!raw,
    state: raw?.state ?? null,
    ctx: raw?.ctx ?? null,
    players: raw?.players ?? [],
    listedPlayers,
    playersById,
    schedule: raw?.schedule ?? null,
    projections: raw?.projections ?? {},
    defense: raw?.defense ?? null,
    dvp,
    seasons,
    projected,
    positionRanks,
    scoring,
    scoringLabel: options.scoring ? `League scoring (${describeScoring(scoring)})` : describeScoring(scoring),
    getPlayerWithStats,
    getMatchup,
    getUpcoming,
  };
}

export type FantasyData = ReturnType<typeof useFantasyData>;
