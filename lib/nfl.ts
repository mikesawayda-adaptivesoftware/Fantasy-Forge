import { NFL_TEAMS, NflState, SleeperGame, TeamGame, TeamSchedule } from '@/types';

export const REGULAR_SEASON_WEEKS = 18;

export const TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LV: 'Las Vegas Raiders',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SF: 'San Francisco 49ers',
  SEA: 'Seattle Seahawks',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WAS: 'Washington Commanders',
  FA: 'Free Agent',
};

const TEAM_SET = new Set<string>(NFL_TEAMS);

/** Defense player IDs in Sleeper are team abbreviations (e.g. "MIN") */
export function isTeamAbbreviation(id: string): boolean {
  return TEAM_SET.has(id.toUpperCase());
}

export function getTeamDisplayName(abbrev: string): string {
  return TEAM_NAMES[abbrev] || abbrev;
}

export function getTeamLogoUrl(team: string): string {
  return `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;
}

/** Player headshot, or team logo for defenses */
export function getHeadshotUrl(playerId: string, position?: string): string {
  if (position === 'DEF' || isTeamAbbreviation(playerId)) {
    return getTeamLogoUrl(playerId);
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

export function getUserAvatarUrl(avatarId: string | null | undefined): string {
  if (!avatarId) return '/placeholder-avatar.svg';
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
}

// ==========================================
// SEASON / WEEK RESOLUTION
// ==========================================

export interface SeasonContext {
  /** Season to pull projections/matchups from (the "current" season) */
  season: string;
  /** Current week for projections & lineups (1-18) */
  week: number;
  /** Season with completed stats to build game logs from */
  statsSeason: string;
  /** Last week (inclusive) of statsSeason that may contain stats */
  statsThroughWeek: number;
  /** True when the regular season is in progress */
  inSeason: boolean;
}

/**
 * Turn Sleeper's NFL state into the season/week values the app needs.
 * Handles preseason/offseason (falls back to last season's stats) and the
 * postseason (clamps to week 18).
 */
export function resolveSeasonContext(state: NflState, now: Date = new Date()): SeasonContext {
  const rawWeek = Number(state.week) || 0;
  const week = Math.min(Math.max(rawWeek, 1), REGULAR_SEASON_WEEKS);

  if (state.season_type === 'regular' && rawWeek >= 1) {
    return { season: state.season, week, statsSeason: state.season, statsThroughWeek: week, inSeason: true };
  }

  if (state.season_type === 'post') {
    return { season: state.season, week: REGULAR_SEASON_WEEKS, statsSeason: state.season, statsThroughWeek: REGULAR_SEASON_WEEKS, inSeason: false };
  }

  // Offseason / preseason. If `season` hasn't kicked off yet, the most recent
  // complete season is `previous_season`; otherwise `season` just finished.
  const startDate = state.season_start_date ? new Date(state.season_start_date) : null;
  const seasonNotStarted = startDate ? startDate.getTime() > now.getTime() : true;
  return {
    season: state.season,
    week: seasonNotStarted ? 1 : week,
    statsSeason: seasonNotStarted ? state.previous_season : state.season,
    statsThroughWeek: REGULAR_SEASON_WEEKS,
    inSeason: false,
  };
}

// ==========================================
// SCHEDULE HELPERS
// ==========================================

export function normalizeSchedule(games: SleeperGame[]): TeamSchedule {
  const schedule: TeamSchedule = {};
  for (const game of games) {
    if (!game.home || !game.away || !game.week) continue;
    schedule[game.home] ??= {};
    schedule[game.away] ??= {};
    schedule[game.home][game.week] = { opponent: game.away, home: true, date: game.date, status: game.status };
    schedule[game.away][game.week] = { opponent: game.home, home: false, date: game.date, status: game.status };
  }
  return schedule;
}

export function getTeamGame(schedule: TeamSchedule | null | undefined, team: string | null | undefined, week: number): TeamGame | undefined {
  if (!schedule || !team) return undefined;
  return schedule[team.toUpperCase()]?.[week];
}

/**
 * Bye week for a team. Only meaningful when the schedule is loaded and the
 * team has games; returns undefined otherwise.
 */
export function getByeWeek(schedule: TeamSchedule | null | undefined, team: string | null | undefined): number | undefined {
  if (!schedule || !team) return undefined;
  const games = schedule[team.toUpperCase()];
  if (!games || Object.keys(games).length === 0) return undefined;
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    if (!games[week]) return week;
  }
  return undefined;
}

export function isOnBye(schedule: TeamSchedule | null | undefined, team: string | null | undefined, week: number): boolean {
  const bye = getByeWeek(schedule, team);
  return bye !== undefined && bye === week;
}

/** Has this team's game for the week kicked off (or finished)? */
export function hasGameStarted(schedule: TeamSchedule | null | undefined, team: string | null | undefined, week: number): boolean {
  const game = getTeamGame(schedule, team, week);
  return !!game && game.status !== 'pre_game';
}

/**
 * Is the team's game for the week final? Unknown schedule data is treated as
 * final so stats are never hidden because the schedule failed to load.
 */
export function isGameComplete(schedule: TeamSchedule | null | undefined, team: string | null | undefined, week: number): boolean {
  if (!schedule || !team || !schedule[team.toUpperCase()]) return true;
  const game = getTeamGame(schedule, team, week);
  if (!game) return true; // bye week – nothing in progress
  return game.status === 'complete';
}

/** Format an opponent label like "vs KC" or "@ KC" */
export function formatOpponent(game: TeamGame | undefined): string {
  if (!game) return 'BYE';
  return `${game.home ? 'vs' : '@'} ${game.opponent}`;
}
