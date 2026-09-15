import { NFL_TEAMS, StatLine, StatsByPlayer, TeamGame, TeamSchedule } from '@/types';
import { calcPoints, SCORING_PRESETS, ScoringSettings } from './points';
import { getTeamGame, getByeWeek, isGameComplete, REGULAR_SEASON_WEEKS } from './nfl';

export const DVP_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
export type DvpPosition = typeof DVP_POSITIONS[number];

export function isDvpPosition(position: string): position is DvpPosition {
  return (DVP_POSITIONS as readonly string[]).includes(position);
}

export interface DefenseVsPositionEntry {
  /** Fantasy points per game this team allows to the position */
  allowedPerGame: number;
  /** Games from the current season included */
  games: number;
  /** 1 = allows the most points (easiest matchup), 32 = allows the fewest */
  rank: number;
  /** allowedPerGame / league average. > 1 means a favorable matchup */
  multiplier: number;
}

export type DefenseVsPosition = Record<string, Partial<Record<DvpPosition, DefenseVsPositionEntry>>>;

export interface DefenseVsPositionResponse {
  season: string;
  priorSeason: string | null;
  priorGames: number;
  /** Current-season PPR ratings blended with last season */
  teams: DefenseVsPosition;
  /** Last season alone (PPR) – prior for scoring-specific ratings */
  previousTeams: DefenseVsPosition | null;
}

export interface WeeklyTeamStats {
  week: number;
  stats: StatsByPlayer;
  /** Schedule for the season these stats belong to (used to skip in-progress games) */
  schedule?: TeamSchedule | null;
}

type Totals = Record<string, Record<DvpPosition, { points: number; games: number }>>;

/**
 * Sleeper's team (DEF) stat rows include `fan_pts_allow_<pos>`: the PPR points
 * scored by the opponent's players at that position in that game. That makes
 * "points allowed to position" a simple per-team average.
 */
function accumulate(weeks: WeeklyTeamStats[]): Totals {
  const totals: Totals = {};
  for (const team of NFL_TEAMS) {
    totals[team] = { QB: { points: 0, games: 0 }, RB: { points: 0, games: 0 }, WR: { points: 0, games: 0 }, TE: { points: 0, games: 0 }, K: { points: 0, games: 0 }, DEF: { points: 0, games: 0 } };
  }
  for (const { week, stats, schedule } of weeks) {
    for (const team of NFL_TEAMS) {
      const row = stats[team];
      if (!row || !(typeof row.gp === 'number' ? row.gp > 0 : row.fan_pts_allow !== undefined)) continue;
      if (schedule && !isGameComplete(schedule, team, week)) continue;
      for (const position of DVP_POSITIONS) {
        const value = row[`fan_pts_allow_${position.toLowerCase()}`];
        if (typeof value !== 'number') continue;
        totals[team][position].points += value;
        totals[team][position].games += 1;
      }
    }
  }
  return totals;
}

/**
 * Compute defense-vs-position ratings. Early in the season there is very
 * little data, so each team's current numbers are shrunk toward last season's
 * rate (or the league average) using `priorGames` pseudo-games.
 */
export function computeDefenseVsPosition(
  current: WeeklyTeamStats[],
  previous: WeeklyTeamStats[] = [],
  priorGames = 3
): DefenseVsPosition {
  const currentTotals = accumulate(current);
  const previousTotals = previous.length ? accumulate(previous) : null;
  const result: DefenseVsPosition = {};

  for (const position of DVP_POSITIONS) {
    // League average per game for this position (current season, then prior)
    const leagueAvg = (totals: Totals | null) => {
      if (!totals) return null;
      let points = 0;
      let games = 0;
      for (const team of NFL_TEAMS) {
        points += totals[team][position].points;
        games += totals[team][position].games;
      }
      return games > 0 ? points / games : null;
    };
    const currentAvg = leagueAvg(currentTotals);
    const previousAvg = leagueAvg(previousTotals);
    const fallbackAvg = currentAvg ?? previousAvg;
    if (fallbackAvg === null) continue;

    const rates = NFL_TEAMS.map(team => {
      const cur = currentTotals[team][position];
      const prev = previousTotals?.[team][position];
      const priorRate = prev && prev.games > 0 ? prev.points / prev.games : fallbackAvg;
      const allowed = cur.games + priorGames > 0 ? (cur.points + priorRate * priorGames) / (cur.games + priorGames) : priorRate;
      return { team, allowed, games: cur.games };
    });

    rankRates(result, position, rates);
  }

  return result;
}

function rankRates(result: DefenseVsPosition, position: DvpPosition, rates: { team: string; allowed: number; games: number }[]) {
  const avg = rates.reduce((sum, r) => sum + r.allowed, 0) / rates.length;
  const ranked = [...rates].sort((a, b) => b.allowed - a.allowed);
  ranked.forEach((rate, index) => {
    result[rate.team] ??= {};
    result[rate.team][position] = {
      allowedPerGame: Math.round(rate.allowed * 10) / 10,
      games: rate.games,
      rank: index + 1,
      multiplier: avg > 0 ? Math.round((rate.allowed / avg) * 1000) / 1000 : 1,
    };
  });
}

export interface WeeklyPlayerStats {
  week: number;
  stats: StatsByPlayer;
  /** playerId -> [team, opponent] for that week */
  teams: Record<string, [string, string]>;
}

/**
 * Defense-vs-position ratings in any scoring system, built from individual
 * player stat lines and their weekly opponent. Last season's PPR ratings
 * (`prior`) are used as the early-season prior, rescaled to this scoring by
 * each position's league-wide scoring ratio.
 */
export function computeDefenseVsPositionForScoring(params: {
  weeks: WeeklyPlayerStats[];
  scoring: ScoringSettings;
  positionOf: (playerId: string) => string | undefined;
  schedule?: TeamSchedule | null;
  prior?: DefenseVsPosition | null;
  priorGames?: number;
}): DefenseVsPosition | null {
  const { weeks, scoring, positionOf, schedule, prior, priorGames = 3 } = params;
  const points: Record<string, Record<DvpPosition, number>> = {};
  const pprPoints: Record<DvpPosition, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  const scoredPoints: Record<DvpPosition, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  const gamesByTeam: Record<string, Set<number>> = {};
  for (const team of NFL_TEAMS) {
    points[team] = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
    gamesByTeam[team] = new Set();
  }

  let anyRows = false;
  for (const { week, stats, teams } of weeks) {
    for (const playerId in teams) {
      const [team, opponent] = teams[playerId];
      if (!points[opponent]) continue;
      if (schedule && !isGameComplete(schedule, team, week)) continue;
      const line = stats[playerId];
      const position = positionOf(playerId);
      if (!line || !position || !isDvpPosition(position) || !hasPlayedLine(line)) continue;
      const scored = calcPoints(line, scoring);
      points[opponent][position] += scored;
      scoredPoints[position] += scored;
      pprPoints[position] += calcPoints(line, SCORING_PRESETS.ppr);
      gamesByTeam[opponent].add(week);
      anyRows = true;
    }
  }
  if (!anyRows && !prior) return null;

  const result: DefenseVsPosition = {};
  for (const position of DVP_POSITIONS) {
    // Convert last season's PPR rates into this scoring system
    const scale = pprPoints[position] > 0 ? scoredPoints[position] / pprPoints[position] : 1;
    const totalGames = NFL_TEAMS.reduce((sum, team) => sum + gamesByTeam[team].size, 0);
    const currentAvg = totalGames > 0 ? NFL_TEAMS.reduce((sum, team) => sum + points[team][position], 0) / totalGames : null;
    const priorRates = NFL_TEAMS.map(team => prior?.[team]?.[position]?.allowedPerGame).filter((v): v is number => typeof v === 'number');
    const priorAvg = priorRates.length ? (priorRates.reduce((a, b) => a + b, 0) / priorRates.length) * scale : null;
    const fallbackAvg = currentAvg ?? priorAvg;
    if (fallbackAvg === null) continue;

    const rates = NFL_TEAMS.map(team => {
      const games = gamesByTeam[team].size;
      const priorEntry = prior?.[team]?.[position];
      const priorRate = priorEntry ? priorEntry.allowedPerGame * scale : fallbackAvg;
      const allowed = games + priorGames > 0 ? (points[team][position] + priorRate * priorGames) / (games + priorGames) : fallbackAvg;
      return { team, allowed, games };
    });
    rankRates(result, position, rates);
  }
  return result;
}

function hasPlayedLine(line: StatLine): boolean {
  return typeof line.gp === 'number' ? line.gp > 0 : true;
}

// ==========================================
// MATCHUP GRADES
// ==========================================

export type MatchupGrade = 'great' | 'good' | 'neutral' | 'tough' | 'brutal';

export const MATCHUP_GRADE_LABELS: Record<MatchupGrade, string> = {
  great: 'Great',
  good: 'Good',
  neutral: 'Neutral',
  tough: 'Tough',
  brutal: 'Brutal',
};

export function gradeFromMultiplier(multiplier: number): MatchupGrade {
  if (multiplier >= 1.15) return 'great';
  if (multiplier >= 1.05) return 'good';
  if (multiplier > 0.95) return 'neutral';
  if (multiplier > 0.85) return 'tough';
  return 'brutal';
}

export interface MatchupInfo {
  week: number;
  bye: boolean;
  game?: TeamGame;
  opponent?: string;
  entry?: DefenseVsPositionEntry;
  grade?: MatchupGrade;
}

export function getMatchupInfo(params: {
  position: string;
  team: string;
  week: number;
  schedule: TeamSchedule | null | undefined;
  dvp: DefenseVsPosition | null | undefined;
}): MatchupInfo {
  const { position, team, week, schedule, dvp } = params;
  const game = getTeamGame(schedule, team, week);
  if (!game) {
    const bye = getByeWeek(schedule, team) === week;
    return { week, bye };
  }
  const entry = isDvpPosition(position) ? dvp?.[game.opponent]?.[position] : undefined;
  return {
    week,
    bye: false,
    game,
    opponent: game.opponent,
    entry,
    grade: entry ? gradeFromMultiplier(entry.multiplier) : undefined,
  };
}

/** Upcoming matchups for the next `count` weeks, starting at `fromWeek` */
export function getUpcomingMatchups(params: {
  position: string;
  team: string;
  fromWeek: number;
  count: number;
  schedule: TeamSchedule | null | undefined;
  dvp: DefenseVsPosition | null | undefined;
}): MatchupInfo[] {
  const { fromWeek, count, ...rest } = params;
  const matchups: MatchupInfo[] = [];
  for (let week = fromWeek; week < fromWeek + count && week <= REGULAR_SEASON_WEEKS; week++) {
    matchups.push(getMatchupInfo({ ...rest, week }));
  }
  return matchups;
}

/** Average matchup multiplier over a set of weeks, ignoring byes/unknowns */
export function strengthOfSchedule(matchups: MatchupInfo[]): { multiplier: number; grade: MatchupGrade } | null {
  const values = matchups.map(m => m.entry?.multiplier).filter((v): v is number => typeof v === 'number');
  if (!values.length) return null;
  const multiplier = values.reduce((a, b) => a + b, 0) / values.length;
  return { multiplier: Math.round(multiplier * 1000) / 1000, grade: gradeFromMultiplier(multiplier) };
}
