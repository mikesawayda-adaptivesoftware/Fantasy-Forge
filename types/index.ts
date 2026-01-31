// Sleeper API Player type
export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: Position;
  team: string | null;
  age?: number;
  years_exp?: number;
  college?: string;
  height?: string;
  weight?: string;
  status?: string;
  injury_status?: string | null;
  injury_body_part?: string | null;
  injury_notes?: string | null;
  number?: number;
  depth_chart_position?: string;
  depth_chart_order?: number;
  fantasy_positions?: string[];
  search_rank?: number;
  espn_id?: string;
  yahoo_id?: string;
  rotowire_id?: number;
  sportradar_id?: string;
}

// Position types
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'DL' | 'LB' | 'DB';

export const FANTASY_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

// Player stats from Sleeper
export interface PlayerStats {
  player_id: string;
  week: number;
  season: string;
  season_type: string;
  stats: {
    // Passing
    pass_att?: number;
    pass_cmp?: number;
    pass_yd?: number;
    pass_td?: number;
    pass_int?: number;
    pass_sack?: number;
    
    // Rushing
    rush_att?: number;
    rush_yd?: number;
    rush_td?: number;
    rush_fd?: number;
    
    // Receiving
    rec?: number;
    rec_tgt?: number;
    rec_yd?: number;
    rec_td?: number;
    rec_fd?: number;
    
    // Kicking
    fgm?: number;
    fga?: number;
    xpm?: number;
    xpa?: number;
    
    // Defense
    def_td?: number;
    sack?: number;
    int?: number;
    fum_rec?: number;
    pts_allow?: number;
    safe?: number;
    blk_kick?: number;
    ff?: number;
    
    // Fantasy points (calculated)
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
  };
}

// Player projections
export interface PlayerProjection {
  player_id: string;
  week: number;
  season: string;
  stats: PlayerStats['stats'];
}

// Simplified player for UI
export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  team: string;
  age?: number;
  experience?: number;
  college?: string;
  number?: number;
  injuryStatus?: string | null;
  searchRank?: number;
  headshot?: string;
}

// Weekly game log entry
export interface GameLogEntry {
  week: number;
  opponent?: string;
  stats: PlayerStats['stats'];
  fantasyPoints: number;
  projectedPoints?: number;
}

// Player with full data
export interface PlayerWithStats extends Player {
  seasonStats?: PlayerStats['stats'];
  projectedPoints?: number;
  avgPoints?: number;
  recentAvgPoints?: number; // Last 3 weeks
  gameLog?: GameLogEntry[];
}

// Comparison result
export interface ComparisonResult {
  player1: PlayerWithStats;
  player2: PlayerWithStats;
  winner: 'player1' | 'player2' | 'tie';
  confidence: number; // 0-100
  breakdown: {
    category: string;
    player1Value: number;
    player2Value: number;
    winner: 'player1' | 'player2' | 'tie';
  }[];
}

// Start/Sit recommendation
export interface StartSitRecommendation {
  start: PlayerWithStats;
  sit: PlayerWithStats;
  confidence: number; // 0-100
  reasons: string[];
}

// Trade analysis
export interface TradeAnalysis {
  team1Players: PlayerWithStats[];
  team2Players: PlayerWithStats[];
  team1Value: number;
  team2Value: number;
  winner: 'team1' | 'team2' | 'fair';
  valueDifference: number;
  recommendation: string;
}

// Search/filter options
export interface PlayerFilters {
  position?: Position | 'ALL';
  team?: string;
  searchQuery?: string;
  sortBy?: 'name' | 'projected' | 'avgPoints' | 'searchRank';
  sortOrder?: 'asc' | 'desc';
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
    waiver_day_of_week?: number;
    waiver_clear_days?: number;
    waiver_budget?: number;
    type?: number;
    trade_review_days?: number;
    trade_deadline?: number;
    taxi_slots?: number;
    taxi_deadline?: number;
    taxi_allow_vets?: number;
    start_week?: number;
    reserve_slots?: number;
    reserve_allow_out?: number;
    reg_season_weeks?: number;
    pts_in_decimal?: number;
    playoff_week_start?: number;
    playoff_teams?: number;
    pick_trading?: number;
    offseason_adds?: number;
    num_teams?: number;
    max_keepers?: number;
    leg?: number;
    last_scored_leg?: number;
    last_report?: number;
    draft_rounds?: number;
    daily_waivers_hour?: number;
    capacity_override?: number;
    bench_lock?: number;
  };
  scoring_settings: Record<string, number>;
  avatar: string | null;
  draft_id: string | null;
  previous_league_id: string | null;
}

// Sleeper Roster
export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
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
  };
}

// Sleeper League User (member of a league)
export interface SleeperLeagueUser {
  user_id: string;
  username: string;
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
  matchup_id: number;
  players: string[];
  starters: string[];
  points: number;
  starters_points: number[];
  players_points: Record<string, number>;
  custom_points?: number;
}

// Processed types for our app

// User's league with additional context
export interface UserLeague extends SleeperLeague {
  userRosterId?: number;
  userRecord?: {
    wins: number;
    losses: number;
    ties: number;
  };
}

// Roster with player details
export interface RosterWithPlayers {
  roster: SleeperRoster;
  owner: SleeperLeagueUser | null;
  players: Player[];
  starters: Player[];
  bench: Player[];
  projectedPoints: number;
}

// Matchup with full details
export interface MatchupDetails {
  matchupId: number;
  week: number;
  userTeam: RosterWithPlayers;
  opponentTeam: RosterWithPlayers;
  userProjected: number;
  opponentProjected: number;
  userActual: number;
  opponentActual: number;
  userPlayerPoints: Record<string, number>;
  opponentPlayerPoints: Record<string, number>;
  playerProjections: Record<string, number>;
}

// Roster slot types
export const ROSTER_SLOTS = {
  QB: 'QB',
  RB: 'RB', 
  WR: 'WR',
  TE: 'TE',
  FLEX: 'FLEX',
  SUPER_FLEX: 'SUPER_FLEX',
  K: 'K',
  DEF: 'DEF',
  BN: 'BN',
  IR: 'IR',
} as const;

