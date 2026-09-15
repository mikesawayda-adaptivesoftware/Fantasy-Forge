// ==========================================
// CORE PLAYER TYPES
// ==========================================

// Position types
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'DL' | 'LB' | 'DB';

export const FANTASY_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export const IDP_POSITIONS: Position[] = ['DL', 'LB', 'DB'];

/**
 * A single stat line from Sleeper (weekly stats or projections).
 * Keys are Sleeper stat keys (pass_yd, rec, fum_lost, pts_allow_0, ...), which
 * line up 1:1 with league `scoring_settings` keys.
 */
export type StatLine = { [stat: string]: number | undefined };

/** Weekly stats or projections keyed by player ID */
export type StatsByPlayer = Record<string, StatLine>;

/** Weekly stats plus each player's [team, opponent] for that week */
export interface WeeklyStatsPayload {
  stats: StatsByPlayer;
  teams: Record<string, [team: string, opponent: string]>;
}

// Sleeper API Player type (raw)
export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  position: Position;
  team: string | null;
  age?: number;
  years_exp?: number;
  college?: string;
  number?: number;
  status?: string | null;
  active?: boolean;
  injury_status?: string | null;
  injury_body_part?: string | null;
  injury_notes?: string | null;
  search_rank?: number | null;
  fantasy_positions?: string[] | null;
}

// Simplified player for UI (served by /api/nfl/players)
export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  /** Every fantasy position the player is eligible at, when more than `position` */
  fantasyPositions?: Position[];
  team: string; // 'FA' when unsigned
  age?: number;
  experience?: number;
  college?: string;
  number?: number;
  status?: string;
  injuryStatus?: string | null;
  injuryBodyPart?: string;
  injuryNotes?: string;
  /** Epoch ms of Sleeper's latest news/injury update */
  injuryUpdatedAt?: number;
  searchRank?: number;
}

// Weekly game log entry
export interface GameLogEntry {
  week: number;
  /** Team the player was on that week */
  team?: string;
  opponent?: string;
  home?: boolean;
  stats: StatLine;
  fantasyPoints: number;
  projectedPoints?: number;
}

// Season summary computed from weekly stats
export interface PlayerSeason {
  gameLog: GameLogEntry[];
  gamesPlayed: number;
  totalPoints: number;
  avgPoints: number;
  recentAvgPoints: number; // Last 3 games played
  stdDev: number | null; // null when fewer than 2 games
}

// Player with full data
export interface PlayerWithStats extends Player {
  projectedPoints?: number;
  avgPoints?: number;
  recentAvgPoints?: number;
  totalPoints?: number;
  gamesPlayed?: number;
  stdDev?: number | null;
  gameLog?: GameLogEntry[];
}

// ==========================================
// NFL STATE & SCHEDULE
// ==========================================

// Response from Sleeper /v1/state/nfl
export interface NflState {
  week: number;
  season: string;
  season_type: 'pre' | 'regular' | 'post' | 'off' | string;
  display_week: number;
  league_season: string;
  previous_season: string;
  season_start_date?: string;
  season_has_scores?: boolean;
  leg?: number;
}

export type GameStatus = 'pre_game' | 'in_game' | 'complete' | string;

// Raw game from Sleeper's schedule endpoint
export interface SleeperGame {
  week: number;
  home: string;
  away: string;
  date: string;
  status: GameStatus;
  game_id: string;
}

export interface TeamGame {
  opponent: string;
  home: boolean;
  date: string;
  status: GameStatus;
  /** ISO kickoff time (current/next week only) */
  kickoff?: string;
  teamScore?: number;
  opponentScore?: number;
  /** e.g. "Q3 08:21" while in progress */
  clock?: string;
}

/** team -> week -> game (weeks without an entry are byes) */
export type TeamSchedule = Record<string, Record<number, TeamGame>>;

// ==========================================
// ANALYSIS RESULTS
// ==========================================

export type Winner = 'player1' | 'player2' | 'tie';

export interface ComparisonCategory {
  category: string;
  player1Value: number;
  player2Value: number;
  winner: Winner;
  higherIsBetter: boolean;
  weight: number;
  format: 'points' | 'percent' | 'multiplier';
}

// Comparison result
export interface ComparisonResult {
  player1: PlayerWithStats;
  player2: PlayerWithStats;
  winner: Winner;
  confidence: number; // 50-100
  breakdown: ComparisonCategory[];
}

// Start/Sit recommendation
export interface StartSitRecommendation {
  start: PlayerWithStats;
  sit: PlayerWithStats;
  confidence: number; // 50-100
  reasons: string[];
  tossUp: boolean;
}

export interface TradePlayerValue {
  player: PlayerWithStats;
  rawValue: number;
  replacementValue: number;
  valueOverReplacement: number;
}

export interface TradePickValue {
  id: string;
  label: string;
  value: number;
}

// Trade analysis
export interface TradeAnalysis {
  givePlayers: TradePlayerValue[];
  receivePlayers: TradePlayerValue[];
  givePicks: TradePickValue[];
  receivePicks: TradePickValue[];
  giveValue: number;
  receiveValue: number;
  winner: 'give' | 'receive' | 'fair';
  valueDifference: number;
  recommendation: string;
  rosterSpotNote?: string;
}

// NFL Teams
export const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
] as const;

export type NFLTeam = typeof NFL_TEAMS[number];

// ==========================================
// SLEEPER USER & LEAGUE TYPES
// ==========================================

// Sleeper User
export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

// Sleeper League
export interface SleeperLeague {
  league_id: string;
  name: string;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  sport: string;
  season: string;
  season_type: string;
  total_rosters: number;
  roster_positions: string[];
  settings: {
    wins_bracket?: number;
    waiver_type?: number;
    waiver_budget?: number;
    type?: number;
    trade_deadline?: number;
    start_week?: number;
    reg_season_weeks?: number;
    playoff_week_start?: number;
    playoff_teams?: number;
    num_teams?: number;
    leg?: number;
    last_scored_leg?: number;
    [setting: string]: number | undefined;
  };
  scoring_settings: Record<string, number>;
  avatar: string | null;
  draft_id: string | null;
  previous_league_id: string | null;
}

// Sleeper Roster
export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  co_owners?: string[] | null;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    ppts?: number;
    ppts_decimal?: number;
  };
  metadata?: {
    streak?: string;
    record?: string;
  } | null;
}

// Sleeper League User (member of a league)
export interface SleeperLeagueUser {
  user_id: string;
  username?: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
    avatar?: string;
  };
  is_owner?: boolean;
}

// Sleeper Matchup
export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  players: string[] | null;
  starters: string[] | null;
  points: number;
  starters_points?: number[];
  players_points?: Record<string, number>;
  custom_points?: number | null;
}

// Trending players from Sleeper
export interface TrendingPlayer {
  player_id: string;
  count: number;
}

// User's league with additional context
export interface UserLeague extends SleeperLeague {
  userRosterId?: number;
  userRecord?: {
    wins: number;
    losses: number;
    ties: number;
  };
}
