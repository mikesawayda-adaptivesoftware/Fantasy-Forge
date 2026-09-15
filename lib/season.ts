import { GameLogEntry, Player, PlayerSeason, PlayerWithStats, StatLine, StatsByPlayer, TeamSchedule } from '@/types';
import { calcPoints, ScoringSettings } from './points';
import { getTeamGame, isGameComplete } from './nfl';

export interface WeekStats {
  week: number;
  stats: StatsByPlayer;
}

const RECENT_GAMES = 3;

/** Did the player/defense actually take part in the game? */
export function hasPlayed(stats: StatLine): boolean {
  if (typeof stats.gp === 'number') return stats.gp > 0;
  // Fallback for stat lines without a games-played flag
  return Boolean(
    stats.pass_att || stats.rush_att || stats.rec_tgt || stats.rec ||
    stats.fga || stats.xpa || stats.off_snp ||
    stats.pts_allow !== undefined
  );
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function summarizeGameLog(gameLog: GameLogEntry[]): PlayerSeason {
  const points = gameLog.map(g => g.fantasyPoints);
  const totalPoints = points.reduce((a, b) => a + b, 0);
  const recent = points.slice(-RECENT_GAMES);
  return {
    gameLog,
    gamesPlayed: gameLog.length,
    totalPoints: round1(totalPoints),
    avgPoints: gameLog.length ? round1(totalPoints / gameLog.length) : 0,
    recentAvgPoints: recent.length ? round1(recent.reduce((a, b) => a + b, 0) / recent.length) : 0,
    stdDev: standardDeviation(points),
  };
}

/**
 * Build season summaries (game log, averages, consistency) for every player
 * that appears in the weekly stats. Games that are still in progress are left
 * out so partial scores don't distort averages.
 */
export function buildPlayerSeasons(params: {
  weeks: WeekStats[];
  scoring: ScoringSettings;
  playersById: Map<string, Player>;
  schedule?: TeamSchedule | null;
}): Map<string, PlayerSeason> {
  const { weeks, scoring, playersById, schedule } = params;
  const logs = new Map<string, GameLogEntry[]>();
  const orderedWeeks = [...weeks].sort((a, b) => a.week - b.week);

  for (const { week, stats } of orderedWeeks) {
    for (const playerId in stats) {
      const player = playersById.get(playerId);
      if (!player) continue;
      const line = stats[playerId];
      if (!hasPlayed(line)) continue;
      if (!isGameComplete(schedule, player.team, week)) continue;

      const game = getTeamGame(schedule, player.team, week);
      const entry: GameLogEntry = {
        week,
        stats: line,
        fantasyPoints: calcPoints(line, scoring),
        opponent: game?.opponent,
        home: game?.home,
      };
      const log = logs.get(playerId);
      if (log) log.push(entry);
      else logs.set(playerId, [entry]);
    }
  }

  const seasons = new Map<string, PlayerSeason>();
  logs.forEach((log, playerId) => seasons.set(playerId, summarizeGameLog(log)));
  return seasons;
}

export const EMPTY_SEASON: PlayerSeason = {
  gameLog: [],
  gamesPlayed: 0,
  totalPoints: 0,
  avgPoints: 0,
  recentAvgPoints: 0,
  stdDev: null,
};

export function withStats(player: Player, season: PlayerSeason | undefined, projectedPoints: number): PlayerWithStats {
  const s = season ?? EMPTY_SEASON;
  return {
    ...player,
    projectedPoints,
    avgPoints: s.avgPoints,
    recentAvgPoints: s.recentAvgPoints,
    totalPoints: s.totalPoints,
    gamesPlayed: s.gamesPlayed,
    stdDev: s.stdDev,
    gameLog: s.gameLog,
  };
}

/**
 * Rank players within their position by season average (1 = best).
 * Players need at least `minGames` games to be ranked.
 */
export function computePositionRanks(
  players: Player[],
  seasons: Map<string, PlayerSeason>,
  minGames = 1
): Map<string, number> {
  const byPosition = new Map<string, { id: string; avg: number }[]>();
  for (const player of players) {
    const season = seasons.get(player.id);
    if (!season || season.gamesPlayed < minGames) continue;
    const list = byPosition.get(player.position) ?? [];
    list.push({ id: player.id, avg: season.avgPoints });
    byPosition.set(player.position, list);
  }
  const ranks = new Map<string, number>();
  byPosition.forEach(list => {
    list.sort((a, b) => b.avg - a.avg).forEach((item, index) => ranks.set(item.id, index + 1));
  });
  return ranks;
}

/** Tier from positional rank (assumes a 12-team league) */
export function tierFromRank(rank: number | undefined): number {
  if (!rank) return 5;
  if (rank <= 6) return 1;
  if (rank <= 12) return 2;
  if (rank <= 24) return 3;
  if (rank <= 36) return 4;
  return 5;
}

/**
 * Blend this week's projection with season/recent production into a per-week
 * value. Production is trusted more as the sample grows (full weight at 4 games).
 */
export function blendedValue(params: { projection: number; avgPoints: number; recentAvgPoints: number; gamesPlayed: number }): number {
  const { projection, avgPoints, recentAvgPoints, gamesPlayed } = params;
  if (gamesPlayed === 0) return projection;
  const historyWeight = Math.min(1, gamesPlayed / 4) * 0.5;
  return Math.round((projection * (1 - historyWeight) + (avgPoints * 0.5 + recentAvgPoints * 0.5) * historyWeight) * 10) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
