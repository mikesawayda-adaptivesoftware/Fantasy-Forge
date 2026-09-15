import { Player, Position, SleeperMatchup, SleeperRoster, TeamSchedule } from '@/types';
import { getTeamGame, isTeamAbbreviation } from './nfl';

/** Position given to IDs missing from the player database (never fills a slot) */
export const UNKNOWN_POSITION = 'UNKNOWN' as Position;

/** Look up a roster player, falling back to a placeholder for unknown IDs */
export function resolvePlayer(id: string, playersById: Map<string, Player>): Player {
  const player = playersById.get(id);
  if (player) return player;
  const isDefense = isTeamAbbreviation(id);
  return {
    id,
    name: isDefense ? `${id} DEF` : 'Unknown player',
    firstName: '',
    lastName: '',
    position: isDefense ? 'DEF' : UNKNOWN_POSITION,
    team: isDefense ? id : 'FA',
  };
}

export function isKnownPlayer(id: string, playersById: Map<string, Player>): boolean {
  return playersById.has(id) || isTeamAbbreviation(id);
}

export type PlayerGameState = 'pre_game' | 'in_game' | 'complete' | 'bye';

/**
 * Game state for a player this week. Uses live status and the exact kickoff
 * time when available; otherwise any recorded points or a game date in the
 * past count as "started".
 */
export function playerGameState(
  schedule: TeamSchedule | null,
  team: string,
  week: number,
  actualPoints?: number,
  now: Date = new Date()
): PlayerGameState {
  const game = getTeamGame(schedule, team, week);
  if (!game) return schedule && schedule[team] ? 'bye' : actualPoints ? 'in_game' : 'pre_game';
  if (game.status === 'complete') return 'complete';
  if (game.status === 'in_game') return 'in_game';
  if (actualPoints) return 'in_game';
  if (game.kickoff) {
    // Exact kickoff time (current/next week): Sleeper locks players at kickoff
    return now.getTime() >= new Date(game.kickoff).getTime() ? 'in_game' : 'pre_game';
  }
  if (game.date) {
    // Game dates are calendar days (US time); treat anything before today as started
    const today = now.toISOString().slice(0, 10);
    if (game.date < today) return 'in_game';
  }
  return 'pre_game';
}

/**
 * Projected final score for a lineup: actual points for finished games,
 * the higher of actual/projection for games in progress, projection otherwise.
 */
export function projectedFinal(params: {
  starterIds: string[];
  playersById: Map<string, Player>;
  schedule: TeamSchedule | null;
  week: number;
  actualPoints: Record<string, number>;
  projected: Map<string, number>;
}): number {
  const { starterIds, playersById, schedule, week, actualPoints, projected } = params;
  let total = 0;
  for (const id of starterIds) {
    if (!id || id === '0') continue;
    const player = resolvePlayer(id, playersById);
    const actual = actualPoints[id] ?? 0;
    const state = playerGameState(schedule, player.team, week, actual);
    const proj = projected.get(id) ?? 0;
    if (state === 'complete') total += actual;
    else if (state === 'in_game') total += Math.max(actual, proj);
    else if (state === 'pre_game') total += proj;
  }
  return Math.round(total * 10) / 10;
}

/** Players on the bench (not starting, not on IR or taxi) */
export function getBenchIds(roster: SleeperRoster, starterIds: (string | null)[]): string[] {
  const excluded = new Set([...(roster.reserve ?? []), ...(roster.taxi ?? []), ...starterIds.filter(Boolean)] as string[]);
  return (roster.players ?? []).filter(id => !excluded.has(id));
}

/** Starters for the current week: the matchup lineup if present, else the roster's */
export function getCurrentStarters(roster: SleeperRoster, matchup: SleeperMatchup | null | undefined): string[] {
  return (matchup?.starters ?? roster.starters ?? []).map(id => id ?? '0');
}

// ==========================================
// LEAGUE SHAPE
// ==========================================

const IDP_SLOTS = new Set(['DL', 'LB', 'DB', 'IDP_FLEX']);

export function leagueHasIdp(rosterPositions: string[] | null | undefined): boolean {
  return (rosterPositions ?? []).some(slot => IDP_SLOTS.has(slot));
}

export function isDynastyLeague(league: { settings: { type?: number } } | null | undefined): boolean {
  return league?.settings.type === 2;
}

/** How flex slots are typically filled across a league */
const FLEX_SHARES: Record<string, Record<string, number>> = {
  FLEX: { RB: 0.45, WR: 0.45, TE: 0.1 },
  WRRB_FLEX: { RB: 0.5, WR: 0.5 },
  REC_FLEX: { WR: 0.8, TE: 0.2 },
  SUPER_FLEX: { QB: 0.8, RB: 0.1, WR: 0.1 },
  IDP_FLEX: { DL: 0.3, LB: 0.4, DB: 0.3 },
};

/**
 * League-wide number of starters at each position (e.g. a 10-team superflex
 * league starts ~18 QBs). Drives replacement levels for trade values.
 */
export function startersPerPositionForLeague(rosterPositions: string[], totalRosters: number): Record<string, number> {
  const perTeam: Record<string, number> = {};
  for (const slot of rosterPositions) {
    if (slot === 'BN' || slot === 'IR' || slot === 'TAXI') continue;
    const shares = FLEX_SHARES[slot] ?? { [slot]: 1 };
    for (const position in shares) perTeam[position] = (perTeam[position] ?? 0) + shares[position];
  }
  const result: Record<string, number> = {};
  for (const position in perTeam) result[position] = Math.max(1, Math.round(perTeam[position] * totalRosters));
  return result;
}
