import { 
  SleeperPlayer, 
  PlayerStats, 
  PlayerProjection, 
  Player, 
  PlayerWithStats, 
  Position, 
  FANTASY_POSITIONS,
  SleeperUser, 
  SleeperLeague, 
  SleeperRoster, 
  SleeperLeagueUser, 
  SleeperMatchup,
  UserLeague,
  RosterWithPlayers,
  MatchupDetails
} from '@/types';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

// Cache for player data
let playersCache: Map<string, SleeperPlayer> | null = null;
let playersCacheTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Cache for NFL schedule
let scheduleCache: Map<string, Map<number, string>> | null = null; // team -> week -> opponent
let scheduleCacheTime: number = 0;

// NFL Schedule 2024 - maps team to opponent by week
// Format: { team: { week: opponent } }
const NFL_SCHEDULE_2024: Record<string, Record<number, string>> = {
  'ARI': { 1: 'BUF', 2: 'LAR', 3: 'DET', 4: 'WAS', 5: 'SF', 6: 'GB', 7: 'LAC', 8: 'MIA', 9: 'CHI', 10: 'NYJ', 11: 'BYE', 12: 'SEA', 13: 'MIN', 14: 'SEA', 15: 'NE', 16: 'CAR', 17: 'LAR', 18: 'SF' },
  'ATL': { 1: 'PIT', 2: 'PHI', 3: 'KC', 4: 'NO', 5: 'BYE', 6: 'CAR', 7: 'SEA', 8: 'TB', 9: 'DAL', 10: 'NO', 11: 'DEN', 12: 'BYE', 13: 'LAC', 14: 'MIN', 15: 'LV', 16: 'NYG', 17: 'WAS', 18: 'CAR' },
  'BAL': { 1: 'KC', 2: 'LV', 3: 'DAL', 4: 'BUF', 5: 'CIN', 6: 'WAS', 7: 'TB', 8: 'CLE', 9: 'DEN', 10: 'CIN', 11: 'PIT', 12: 'LAC', 13: 'PHI', 14: 'BYE', 15: 'NYG', 16: 'PIT', 17: 'HOU', 18: 'CLE' },
  'BUF': { 1: 'ARI', 2: 'MIA', 3: 'JAX', 4: 'BAL', 5: 'HOU', 6: 'NYJ', 7: 'TEN', 8: 'SEA', 9: 'MIA', 10: 'IND', 11: 'KC', 12: 'BYE', 13: 'SF', 14: 'LAR', 15: 'DET', 16: 'NE', 17: 'NYJ', 18: 'NE' },
  'CAR': { 1: 'NO', 2: 'LAC', 3: 'LV', 4: 'CIN', 5: 'CHI', 6: 'ATL', 7: 'WAS', 8: 'DEN', 9: 'NO', 10: 'NYG', 11: 'BYE', 12: 'KC', 13: 'TB', 14: 'PHI', 15: 'DAL', 16: 'ARI', 17: 'TB', 18: 'ATL' },
  'CHI': { 1: 'TEN', 2: 'HOU', 3: 'IND', 4: 'LAR', 5: 'CAR', 6: 'JAX', 7: 'BYE', 8: 'WAS', 9: 'ARI', 10: 'NE', 11: 'GB', 12: 'MIN', 13: 'DET', 14: 'SF', 15: 'MIN', 16: 'DET', 17: 'SEA', 18: 'GB' },
  'CIN': { 1: 'NE', 2: 'KC', 3: 'WAS', 4: 'CAR', 5: 'BAL', 6: 'NYG', 7: 'CLE', 8: 'PHI', 9: 'LV', 10: 'BAL', 11: 'LAC', 12: 'BYE', 13: 'PIT', 14: 'DAL', 15: 'TEN', 16: 'CLE', 17: 'DEN', 18: 'PIT' },
  'CLE': { 1: 'DAL', 2: 'JAX', 3: 'NYG', 4: 'LV', 5: 'WAS', 6: 'PHI', 7: 'CIN', 8: 'BAL', 9: 'LAC', 10: 'BYE', 11: 'NO', 12: 'PIT', 13: 'DEN', 14: 'PIT', 15: 'KC', 16: 'CIN', 17: 'MIA', 18: 'BAL' },
  'DAL': { 1: 'CLE', 2: 'NO', 3: 'BAL', 4: 'NYG', 5: 'PIT', 6: 'DET', 7: 'BYE', 8: 'SF', 9: 'ATL', 10: 'PHI', 11: 'HOU', 12: 'WAS', 13: 'NYG', 14: 'CIN', 15: 'CAR', 16: 'TB', 17: 'PHI', 18: 'WAS' },
  'DEN': { 1: 'SEA', 2: 'PIT', 3: 'TB', 4: 'NYJ', 5: 'LV', 6: 'LAC', 7: 'NO', 8: 'CAR', 9: 'BAL', 10: 'KC', 11: 'ATL', 12: 'LV', 13: 'CLE', 14: 'BYE', 15: 'IND', 16: 'LAC', 17: 'CIN', 18: 'KC' },
  'DET': { 1: 'LAR', 2: 'TB', 3: 'ARI', 4: 'SEA', 5: 'BYE', 6: 'DAL', 7: 'MIN', 8: 'TEN', 9: 'GB', 10: 'HOU', 11: 'JAX', 12: 'IND', 13: 'CHI', 14: 'GB', 15: 'BUF', 16: 'CHI', 17: 'SF', 18: 'MIN' },
  'GB': { 1: 'PHI', 2: 'IND', 3: 'TEN', 4: 'MIN', 5: 'LAR', 6: 'ARI', 7: 'HOU', 8: 'JAX', 9: 'DET', 10: 'BYE', 11: 'CHI', 12: 'SF', 13: 'MIA', 14: 'DET', 15: 'SEA', 16: 'NO', 17: 'MIN', 18: 'CHI' },
  'HOU': { 1: 'IND', 2: 'CHI', 3: 'MIN', 4: 'JAX', 5: 'BUF', 6: 'NE', 7: 'GB', 8: 'IND', 9: 'NYJ', 10: 'DET', 11: 'DAL', 12: 'TEN', 13: 'JAX', 14: 'BYE', 15: 'MIA', 16: 'KC', 17: 'BAL', 18: 'TEN' },
  'IND': { 1: 'HOU', 2: 'GB', 3: 'CHI', 4: 'PIT', 5: 'JAX', 6: 'TEN', 7: 'MIA', 8: 'HOU', 9: 'MIN', 10: 'BUF', 11: 'NYJ', 12: 'DET', 13: 'NE', 14: 'BYE', 15: 'DEN', 16: 'TEN', 17: 'NYG', 18: 'JAX' },
  'JAX': { 1: 'MIA', 2: 'CLE', 3: 'BUF', 4: 'HOU', 5: 'IND', 6: 'CHI', 7: 'NE', 8: 'GB', 9: 'PHI', 10: 'MIN', 11: 'DET', 12: 'BYE', 13: 'HOU', 14: 'TEN', 15: 'NYJ', 16: 'LV', 17: 'TEN', 18: 'IND' },
  'KC': { 1: 'BAL', 2: 'CIN', 3: 'ATL', 4: 'LAC', 5: 'NO', 6: 'BYE', 7: 'SF', 8: 'LV', 9: 'TB', 10: 'DEN', 11: 'BUF', 12: 'CAR', 13: 'LV', 14: 'LAC', 15: 'CLE', 16: 'HOU', 17: 'PIT', 18: 'DEN' },
  'LV': { 1: 'LAC', 2: 'BAL', 3: 'CAR', 4: 'CLE', 5: 'DEN', 6: 'PIT', 7: 'LAR', 8: 'KC', 9: 'CIN', 10: 'BYE', 11: 'MIA', 12: 'DEN', 13: 'KC', 14: 'TB', 15: 'ATL', 16: 'JAX', 17: 'NO', 18: 'LAC' },
  'LAC': { 1: 'LV', 2: 'CAR', 3: 'PIT', 4: 'KC', 5: 'BYE', 6: 'DEN', 7: 'ARI', 8: 'NO', 9: 'CLE', 10: 'TEN', 11: 'CIN', 12: 'BAL', 13: 'ATL', 14: 'KC', 15: 'TB', 16: 'DEN', 17: 'NE', 18: 'LV' },
  'LAR': { 1: 'DET', 2: 'ARI', 3: 'SF', 4: 'CHI', 5: 'GB', 6: 'BYE', 7: 'LV', 8: 'MIN', 9: 'SEA', 10: 'MIA', 11: 'NE', 12: 'PHI', 13: 'NO', 14: 'BUF', 15: 'SF', 16: 'NYJ', 17: 'ARI', 18: 'SEA' },
  'MIA': { 1: 'JAX', 2: 'BUF', 3: 'SEA', 4: 'TEN', 5: 'NE', 6: 'BYE', 7: 'IND', 8: 'ARI', 9: 'BUF', 10: 'LAR', 11: 'LV', 12: 'NE', 13: 'GB', 14: 'NYJ', 15: 'HOU', 16: 'SF', 17: 'CLE', 18: 'NYJ' },
  'MIN': { 1: 'NYG', 2: 'SF', 3: 'HOU', 4: 'GB', 5: 'NYJ', 6: 'BYE', 7: 'DET', 8: 'LAR', 9: 'IND', 10: 'JAX', 11: 'TEN', 12: 'CHI', 13: 'ARI', 14: 'ATL', 15: 'CHI', 16: 'SEA', 17: 'GB', 18: 'DET' },
  'NE': { 1: 'CIN', 2: 'SEA', 3: 'NYJ', 4: 'SF', 5: 'MIA', 6: 'HOU', 7: 'JAX', 8: 'NYJ', 9: 'TEN', 10: 'CHI', 11: 'LAR', 12: 'MIA', 13: 'IND', 14: 'BYE', 15: 'ARI', 16: 'BUF', 17: 'LAC', 18: 'BUF' },
  'NO': { 1: 'CAR', 2: 'DAL', 3: 'PHI', 4: 'ATL', 5: 'KC', 6: 'TB', 7: 'DEN', 8: 'LAC', 9: 'CAR', 10: 'ATL', 11: 'CLE', 12: 'BYE', 13: 'LAR', 14: 'NYG', 15: 'WAS', 16: 'GB', 17: 'LV', 18: 'TB' },
  'NYG': { 1: 'MIN', 2: 'WAS', 3: 'CLE', 4: 'DAL', 5: 'SEA', 6: 'CIN', 7: 'PHI', 8: 'PIT', 9: 'WAS', 10: 'CAR', 11: 'BYE', 12: 'TB', 13: 'DAL', 14: 'NO', 15: 'BAL', 16: 'ATL', 17: 'IND', 18: 'PHI' },
  'NYJ': { 1: 'SF', 2: 'TEN', 3: 'NE', 4: 'DEN', 5: 'MIN', 6: 'BUF', 7: 'PIT', 8: 'NE', 9: 'HOU', 10: 'ARI', 11: 'IND', 12: 'BYE', 13: 'SEA', 14: 'MIA', 15: 'JAX', 16: 'LAR', 17: 'BUF', 18: 'MIA' },
  'PHI': { 1: 'GB', 2: 'ATL', 3: 'NO', 4: 'TB', 5: 'BYE', 6: 'CLE', 7: 'NYG', 8: 'CIN', 9: 'JAX', 10: 'DAL', 11: 'WAS', 12: 'LAR', 13: 'BAL', 14: 'CAR', 15: 'PIT', 16: 'WAS', 17: 'DAL', 18: 'NYG' },
  'PIT': { 1: 'ATL', 2: 'DEN', 3: 'LAC', 4: 'IND', 5: 'DAL', 6: 'LV', 7: 'NYJ', 8: 'NYG', 9: 'BYE', 10: 'WAS', 11: 'BAL', 12: 'CLE', 13: 'CIN', 14: 'CLE', 15: 'PHI', 16: 'BAL', 17: 'KC', 18: 'CIN' },
  'SF': { 1: 'NYJ', 2: 'MIN', 3: 'LAR', 4: 'NE', 5: 'ARI', 6: 'SEA', 7: 'KC', 8: 'DAL', 9: 'BYE', 10: 'TB', 11: 'SEA', 12: 'GB', 13: 'BUF', 14: 'CHI', 15: 'LAR', 16: 'MIA', 17: 'DET', 18: 'ARI' },
  'SEA': { 1: 'DEN', 2: 'NE', 3: 'MIA', 4: 'DET', 5: 'NYG', 6: 'SF', 7: 'ATL', 8: 'BUF', 9: 'LAR', 10: 'BYE', 11: 'SF', 12: 'ARI', 13: 'NYJ', 14: 'ARI', 15: 'GB', 16: 'MIN', 17: 'CHI', 18: 'LAR' },
  'TB': { 1: 'WAS', 2: 'DET', 3: 'DEN', 4: 'PHI', 5: 'ATL', 6: 'NO', 7: 'BAL', 8: 'ATL', 9: 'KC', 10: 'SF', 11: 'BYE', 12: 'NYG', 13: 'CAR', 14: 'LV', 15: 'LAC', 16: 'DAL', 17: 'CAR', 18: 'NO' },
  'TEN': { 1: 'CHI', 2: 'NYJ', 3: 'GB', 4: 'MIA', 5: 'BYE', 6: 'IND', 7: 'BUF', 8: 'DET', 9: 'NE', 10: 'LAC', 11: 'MIN', 12: 'HOU', 13: 'WAS', 14: 'JAX', 15: 'CIN', 16: 'IND', 17: 'JAX', 18: 'HOU' },
  'WAS': { 1: 'TB', 2: 'NYG', 3: 'CIN', 4: 'ARI', 5: 'CLE', 6: 'BAL', 7: 'CAR', 8: 'CHI', 9: 'NYG', 10: 'PIT', 11: 'PHI', 12: 'DAL', 13: 'TEN', 14: 'BYE', 15: 'NO', 16: 'PHI', 17: 'ATL', 18: 'DAL' },
};

/**
 * Get opponent for a team in a specific week
 */
export function getOpponentForTeamWeek(team: string | null, week: number): string | undefined {
  if (!team) return undefined;
  const teamSchedule = NFL_SCHEDULE_2024[team.toUpperCase()];
  if (!teamSchedule) return undefined;
  const opponent = teamSchedule[week];
  return opponent === 'BYE' ? 'BYE' : opponent;
}

/**
 * Get the bye week for a team
 */
export function getTeamByeWeek(team: string | null): number | undefined {
  if (!team) return undefined;
  const teamSchedule = NFL_SCHEDULE_2024[team.toUpperCase()];
  if (!teamSchedule) return undefined;
  
  for (const [week, opponent] of Object.entries(teamSchedule)) {
    if (opponent === 'BYE') {
      return parseInt(week);
    }
  }
  return undefined;
}

/**
 * Check if a player has an upcoming bye within N weeks
 */
export function hasUpcomingBye(team: string | null, withinWeeks: number = 2): { hasBye: boolean; byeWeek: number | undefined } {
  const currentWeek = getCurrentWeek();
  const byeWeek = getTeamByeWeek(team);
  
  if (!byeWeek) return { hasBye: false, byeWeek: undefined };
  
  const weeksUntilBye = byeWeek - currentWeek;
  const hasBye = weeksUntilBye > 0 && weeksUntilBye <= withinWeeks;
  
  return { hasBye, byeWeek };
}

/**
 * Check if a player's bye week has already passed
 */
export function isByePassed(team: string | null): boolean {
  const currentWeek = getCurrentWeek();
  const byeWeek = getTeamByeWeek(team);
  
  if (!byeWeek) return true; // No bye info, assume passed
  return currentWeek > byeWeek;
}

/**
 * Fetch all NFL players from Sleeper API
 */
export async function fetchAllPlayers(): Promise<Map<string, SleeperPlayer>> {
  // Return cached data if still valid
  if (playersCache && Date.now() - playersCacheTime < CACHE_DURATION) {
    return playersCache;
  }

  const response = await fetch(`${SLEEPER_BASE_URL}/players/nfl`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.statusText}`);
  }

  const data: Record<string, SleeperPlayer> = await response.json();
  
  // Convert to Map for easier lookups
  playersCache = new Map(Object.entries(data));
  playersCacheTime = Date.now();

  return playersCache;
}

/**
 * Get fantasy-relevant players only (QB, RB, WR, TE, K, DEF)
 */
export async function getFantasyPlayers(): Promise<Player[]> {
  const allPlayers = await fetchAllPlayers();
  const fantasyPlayers: Player[] = [];

  allPlayers.forEach((player, id) => {
    // Only include fantasy-relevant positions with a team
    if (
      player.team &&
      FANTASY_POSITIONS.includes(player.position as Position) &&
      player.status === 'Active'
    ) {
      fantasyPlayers.push(transformPlayer(player));
    }
  });

  // Add team defenses manually (they're not in the players API the same way)
  const defenses = createTeamDefenses();
  fantasyPlayers.push(...defenses);

  // Sort by search rank (lower is better)
  return fantasyPlayers.sort((a, b) => (a.searchRank || 9999) - (b.searchRank || 9999));
}

/**
 * Create defense entries for all NFL teams
 * Sleeper API doesn't include defenses in the players endpoint the same way
 */
function createTeamDefenses(): Player[] {
  const teams: { id: string; name: string; fullName: string }[] = [
    { id: 'ARI', name: 'Cardinals', fullName: 'Arizona Cardinals' },
    { id: 'ATL', name: 'Falcons', fullName: 'Atlanta Falcons' },
    { id: 'BAL', name: 'Ravens', fullName: 'Baltimore Ravens' },
    { id: 'BUF', name: 'Bills', fullName: 'Buffalo Bills' },
    { id: 'CAR', name: 'Panthers', fullName: 'Carolina Panthers' },
    { id: 'CHI', name: 'Bears', fullName: 'Chicago Bears' },
    { id: 'CIN', name: 'Bengals', fullName: 'Cincinnati Bengals' },
    { id: 'CLE', name: 'Browns', fullName: 'Cleveland Browns' },
    { id: 'DAL', name: 'Cowboys', fullName: 'Dallas Cowboys' },
    { id: 'DEN', name: 'Broncos', fullName: 'Denver Broncos' },
    { id: 'DET', name: 'Lions', fullName: 'Detroit Lions' },
    { id: 'GB', name: 'Packers', fullName: 'Green Bay Packers' },
    { id: 'HOU', name: 'Texans', fullName: 'Houston Texans' },
    { id: 'IND', name: 'Colts', fullName: 'Indianapolis Colts' },
    { id: 'JAX', name: 'Jaguars', fullName: 'Jacksonville Jaguars' },
    { id: 'KC', name: 'Chiefs', fullName: 'Kansas City Chiefs' },
    { id: 'LV', name: 'Raiders', fullName: 'Las Vegas Raiders' },
    { id: 'LAC', name: 'Chargers', fullName: 'Los Angeles Chargers' },
    { id: 'LAR', name: 'Rams', fullName: 'Los Angeles Rams' },
    { id: 'MIA', name: 'Dolphins', fullName: 'Miami Dolphins' },
    { id: 'MIN', name: 'Vikings', fullName: 'Minnesota Vikings' },
    { id: 'NE', name: 'Patriots', fullName: 'New England Patriots' },
    { id: 'NO', name: 'Saints', fullName: 'New Orleans Saints' },
    { id: 'NYG', name: 'Giants', fullName: 'New York Giants' },
    { id: 'NYJ', name: 'Jets', fullName: 'New York Jets' },
    { id: 'PHI', name: 'Eagles', fullName: 'Philadelphia Eagles' },
    { id: 'PIT', name: 'Steelers', fullName: 'Pittsburgh Steelers' },
    { id: 'SF', name: '49ers', fullName: 'San Francisco 49ers' },
    { id: 'SEA', name: 'Seahawks', fullName: 'Seattle Seahawks' },
    { id: 'TB', name: 'Buccaneers', fullName: 'Tampa Bay Buccaneers' },
    { id: 'TEN', name: 'Titans', fullName: 'Tennessee Titans' },
    { id: 'WAS', name: 'Commanders', fullName: 'Washington Commanders' },
  ];

  return teams.map((team, index) => ({
    id: team.id,
    name: `${team.fullName} DEF`,
    firstName: team.fullName,
    lastName: 'DEF',
    position: 'DEF' as Position,
    team: team.id,
    searchRank: 500 + index, // Put defenses after skill players
  }));
}

/**
 * Transform Sleeper player to our Player type
 */
export function transformPlayer(sleeper: SleeperPlayer): Player {
  return {
    id: sleeper.player_id,
    name: sleeper.full_name || `${sleeper.first_name} ${sleeper.last_name}`,
    firstName: sleeper.first_name,
    lastName: sleeper.last_name,
    position: sleeper.position as Position,
    team: sleeper.team || 'FA',
    age: sleeper.age,
    experience: sleeper.years_exp,
    college: sleeper.college,
    number: sleeper.number,
    injuryStatus: sleeper.injury_status,
    searchRank: sleeper.search_rank,
    headshot: getHeadshotUrl(sleeper.player_id),
  };
}

/**
 * Get player headshot URL
 * For defenses (DEF position), returns team logo instead of player photo
 */
export function getHeadshotUrl(playerId: string, position?: string): string {
  // Defense IDs are team abbreviations (e.g., "MIN", "DAL")
  // They need team logos instead of player photos
  if (position === 'DEF' || isTeamAbbreviation(playerId)) {
    return `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}

/**
 * Check if an ID is a team abbreviation (used for defenses)
 */
function isTeamAbbreviation(id: string): boolean {
  const teamAbbreviations = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
  ];
  return teamAbbreviations.includes(id.toUpperCase());
}

/**
 * Get a single player by ID
 */
export async function getPlayerById(playerId: string): Promise<Player | null> {
  const allPlayers = await fetchAllPlayers();
  const sleeper = allPlayers.get(playerId);
  
  if (!sleeper) return null;
  
  return transformPlayer(sleeper);
}

/**
 * Search players by name
 */
export async function searchPlayers(query: string, position?: Position | 'ALL'): Promise<Player[]> {
  const players = await getFantasyPlayers();
  const searchLower = query.toLowerCase();

  return players.filter(player => {
    const nameMatch = player.name.toLowerCase().includes(searchLower);
    const positionMatch = !position || position === 'ALL' || player.position === position;
    return nameMatch && positionMatch;
  });
}

/**
 * Fetch player stats for a specific week
 */
export async function fetchWeeklyStats(season: string, week: number): Promise<Record<string, PlayerStats['stats']>> {
  const response = await fetch(
    `${SLEEPER_BASE_URL}/stats/nfl/regular/${season}/${week}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch player projections for a specific week
 */
export async function fetchWeeklyProjections(season: string, week: number): Promise<Record<string, PlayerStats['stats']>> {
  const response = await fetch(
    `${SLEEPER_BASE_URL}/projections/nfl/regular/${season}/${week}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch projections: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get current NFL season
 */
export function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // NFL season typically runs Sept-Feb
  // If we're in Jan-Feb, it's still last year's season
  if (month < 3) {
    return String(year - 1);
  }
  return String(year);
}

/**
 * Get current NFL week (approximate)
 */
export function getCurrentWeek(): number {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 5); // Approx NFL start (first week of Sept)
  
  if (now < seasonStart) {
    return 1; // Preseason or before season
  }
  
  const weeksPassed = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(1, weeksPassed + 1), 18); // NFL has 18 weeks
}

/**
 * Get player with full stats data
 */
export async function getPlayerWithStats(playerId: string): Promise<PlayerWithStats | null> {
  const player = await getPlayerById(playerId);
  if (!player) return null;

  const season = getCurrentSeason();
  const currentWeek = getCurrentWeek();
  
  // Fetch stats and projections for all weeks in parallel
  const gameLog: { week: number; stats: PlayerStats['stats']; fantasyPoints: number; projectedPoints?: number; opponent?: string }[] = [];
  let totalPoints = 0;
  let gamesPlayed = 0;

  // Fetch up to current week
  for (let week = 1; week <= currentWeek; week++) {
    try {
      // Fetch both stats and projections for this week
      const [weekStats, weekProjections] = await Promise.all([
        fetchWeeklyStats(season, week),
        fetchWeeklyProjections(season, week),
      ]);
      
      const playerStats = weekStats[playerId];
      const playerProj = weekProjections[playerId];
      const projectedPts = playerProj ? calculateFantasyPoints(playerProj) : undefined;
      
      if (playerStats) {
        const points = calculateFantasyPoints(playerStats);
        // Only count games where player actually participated
        const played = hasPlayerPlayed(playerStats) || points > 0;
        
        if (played) {
          // Get opponent from schedule lookup
          const opponent = getOpponentForTeamWeek(player.team, week);
          
          gameLog.push({
            week,
            stats: playerStats,
            fantasyPoints: points,
            projectedPoints: projectedPts,
            opponent,
          });
          totalPoints += points;
          gamesPlayed++;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch week ${week} stats:`, error);
    }
  }

  // Calculate recent form from last 3 GAMES PLAYED (not chronological weeks)
  // This handles injuries - if a player missed weeks, we look at their last 3 actual games
  const recentGames = gameLog.slice(-3); // Get last 3 games from the log
  const recentPoints = recentGames.reduce((sum, game) => sum + game.fantasyPoints, 0);
  const recentGamesCount = recentGames.length;

  // Get projections for current/next week
  let projectedPoints = 0;
  try {
    const projections = await fetchWeeklyProjections(season, currentWeek);
    const playerProj = projections[playerId];
    if (playerProj) {
      projectedPoints = calculateFantasyPoints(playerProj);
    }
  } catch (error) {
    console.warn('Failed to fetch projections:', error);
  }

  return {
    ...player,
    gameLog,
    projectedPoints,
    avgPoints: gamesPlayed > 0 ? totalPoints / gamesPlayed : 0,
    recentAvgPoints: recentGamesCount > 0 ? recentPoints / recentGamesCount : 0,
  };
}

/**
 * Calculate fantasy points (PPR scoring)
 */
export function calculateFantasyPoints(stats: PlayerStats['stats']): number {
  let points = 0;

  // Passing
  points += (stats.pass_yd || 0) * 0.04;  // 1 point per 25 yards
  points += (stats.pass_td || 0) * 4;      // 4 points per TD
  points -= (stats.pass_int || 0) * 2;     // -2 points per INT

  // Rushing
  points += (stats.rush_yd || 0) * 0.1;    // 1 point per 10 yards
  points += (stats.rush_td || 0) * 6;      // 6 points per TD

  // Receiving (PPR)
  points += (stats.rec || 0) * 1;          // 1 point per reception
  points += (stats.rec_yd || 0) * 0.1;     // 1 point per 10 yards
  points += (stats.rec_td || 0) * 6;       // 6 points per TD

  // Kicking
  points += (stats.fgm || 0) * 3;          // 3 points per FG (simplified)
  points += (stats.xpm || 0) * 1;          // 1 point per XP

  // Defense/Special Teams (DST)
  // Standard DST scoring
  const defStats = stats as Record<string, number>;
  points += (defStats.sack || 0) * 1;           // 1 point per sack
  points += (defStats.int || 0) * 2;            // 2 points per interception
  points += (defStats.fum_rec || 0) * 2;        // 2 points per fumble recovery
  points += (defStats.def_td || 0) * 6;         // 6 points per defensive TD
  points += (defStats.safe || 0) * 2;           // 2 points per safety
  points += (defStats.blk_kick || 0) * 2;       // 2 points per blocked kick
  points += (defStats.ff || 0) * 1;             // 1 point per forced fumble
  
  // Points allowed scoring (simplified)
  const ptsAllow = defStats.pts_allow;
  if (ptsAllow !== undefined) {
    if (ptsAllow === 0) points += 10;
    else if (ptsAllow <= 6) points += 7;
    else if (ptsAllow <= 13) points += 4;
    else if (ptsAllow <= 20) points += 1;
    else if (ptsAllow <= 27) points += 0;
    else if (ptsAllow <= 34) points -= 1;
    else points -= 4;
  }

  return Math.round(points * 10) / 10; // Round to 1 decimal
}

/**
 * Check if stats indicate a player/defense actually played
 */
function hasPlayerPlayed(stats: PlayerStats['stats']): boolean {
  const s = stats as Record<string, number>;
  
  // Offensive player checks
  if (s.pass_att && s.pass_att > 0) return true;
  if (s.rush_att && s.rush_att > 0) return true;
  if (s.rec_tgt && s.rec_tgt > 0) return true;
  
  // Kicker checks
  if (s.fga && s.fga > 0) return true;
  if (s.xpa && s.xpa > 0) return true;
  
  // Defense checks - if any defensive stats exist, they played
  if (s.pts_allow !== undefined) return true;
  if (s.sack && s.sack > 0) return true;
  if (s.int && s.int > 0) return true;
  if (s.def_td && s.def_td > 0) return true;
  
  return false;
}

/**
 * Get multiple players with stats (for comparison)
 */
export async function getPlayersWithStats(playerIds: string[]): Promise<PlayerWithStats[]> {
  const players = await Promise.all(
    playerIds.map(id => getPlayerWithStats(id))
  );
  return players.filter((p): p is PlayerWithStats => p !== null);
}

// ==========================================
// USER & LEAGUE API FUNCTIONS
// ==========================================

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<SleeperUser | null> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/user/${username}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Get user's avatar URL
 */
export function getUserAvatarUrl(avatarId: string | null): string {
  if (!avatarId) return '/placeholder-avatar.svg';
  return `https://sleepercdn.com/avatars/${avatarId}`;
}

/**
 * Get all leagues for a user in a given season
 */
export async function getUserLeagues(userId: string, season?: string): Promise<SleeperLeague[]> {
  const targetSeason = season || getCurrentSeason();
  
  try {
    const response = await fetch(
      `${SLEEPER_BASE_URL}/user/${userId}/leagues/nfl/${targetSeason}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch leagues: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return [];
  }
}

/**
 * Get league details by ID
 */
export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch league: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching league:', error);
    return null;
  }
}

/**
 * Get all rosters in a league
 */
export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rosters: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching rosters:', error);
    return [];
  }
}

/**
 * Get all users in a league
 */
export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/users`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch league users: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching league users:', error);
    return [];
  }
}

/**
 * Get matchups for a specific week
 */
export async function getLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch matchups: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching matchups:', error);
    return [];
  }
}

/**
 * Get user's roster in a specific league
 */
export async function getUserRoster(leagueId: string, userId: string): Promise<SleeperRoster | null> {
  const rosters = await getLeagueRosters(leagueId);
  return rosters.find(r => r.owner_id === userId) || null;
}

/**
 * Get user's leagues with additional context (record, roster ID)
 */
export async function getUserLeaguesWithContext(userId: string, season?: string): Promise<UserLeague[]> {
  const leagues = await getUserLeagues(userId, season);
  
  const leaguesWithContext: UserLeague[] = await Promise.all(
    leagues.map(async (league) => {
      const rosters = await getLeagueRosters(league.league_id);
      const userRoster = rosters.find(r => r.owner_id === userId);
      
      return {
        ...league,
        userRosterId: userRoster?.roster_id,
        userRecord: userRoster ? {
          wins: userRoster.settings.wins,
          losses: userRoster.settings.losses,
          ties: userRoster.settings.ties,
        } : undefined,
      };
    })
  );
  
  return leaguesWithContext;
}

/**
 * Get roster with full player details
 */
export async function getRosterWithPlayers(
  roster: SleeperRoster,
  leagueUsers: SleeperLeagueUser[]
): Promise<RosterWithPlayers> {
  const allPlayers = await fetchAllPlayers();
  const owner = leagueUsers.find(u => u.user_id === roster.owner_id) || null;
  
  const playerIds = roster.players || [];
  const starterIds = roster.starters || [];
  
  // Get player details for all roster players
  const players: Player[] = playerIds
    .map(id => {
      const sleeper = allPlayers.get(id);
      return sleeper ? transformPlayer(sleeper) : null;
    })
    .filter((p): p is Player => p !== null);
  
  // Separate starters and bench
  const starters: Player[] = starterIds
    .map(id => {
      const sleeper = allPlayers.get(id);
      return sleeper ? transformPlayer(sleeper) : null;
    })
    .filter((p): p is Player => p !== null);
  
  const starterIdSet = new Set(starterIds);
  const bench = players.filter(p => !starterIdSet.has(p.id));
  
  // Calculate projected points for starters
  const season = getCurrentSeason();
  const week = getCurrentWeek();
  let projectedPoints = 0;
  
  try {
    const projections = await fetchWeeklyProjections(season, week);
    for (const starterId of starterIds) {
      if (starterId && projections[starterId]) {
        projectedPoints += calculateFantasyPoints(projections[starterId]);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch projections for roster:', error);
  }
  
  return {
    roster,
    owner,
    players,
    starters,
    bench,
    projectedPoints: Math.round(projectedPoints * 10) / 10,
  };
}

/**
 * Get current week's matchup for a user in a league
 */
export async function getUserMatchup(
  leagueId: string,
  userId: string,
  week?: number
): Promise<MatchupDetails | null> {
  const targetWeek = week || getCurrentWeek();
  const season = getCurrentSeason();
  
  // Get all required data
  const [rosters, leagueUsers, matchups, projections] = await Promise.all([
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getLeagueMatchups(leagueId, targetWeek),
    fetchWeeklyProjections(season, targetWeek),
  ]);
  
  // Find user's roster
  const userRoster = rosters.find(r => r.owner_id === userId);
  if (!userRoster) return null;
  
  // Find user's matchup
  const userMatchup = matchups.find(m => m.roster_id === userRoster.roster_id);
  if (!userMatchup) return null;
  
  // Find opponent's matchup (same matchup_id, different roster_id)
  const opponentMatchup = matchups.find(
    m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id
  );
  if (!opponentMatchup) return null;
  
  // Find opponent's roster
  const opponentRoster = rosters.find(r => r.roster_id === opponentMatchup.roster_id);
  if (!opponentRoster) return null;
  
  // Get full roster details
  const [userTeam, opponentTeam] = await Promise.all([
    getRosterWithPlayers(userRoster, leagueUsers),
    getRosterWithPlayers(opponentRoster, leagueUsers),
  ]);
  
  // Build player projections map for all players in both rosters
  const allPlayerIds = new Set([
    ...(userMatchup.players || []),
    ...(opponentMatchup.players || []),
  ]);
  
  const playerProjections: Record<string, number> = {};
  for (const playerId of allPlayerIds) {
    if (projections[playerId]) {
      playerProjections[playerId] = calculateFantasyPoints(projections[playerId]);
    }
  }
  
  return {
    matchupId: userMatchup.matchup_id,
    week: targetWeek,
    userTeam,
    opponentTeam,
    userProjected: userTeam.projectedPoints,
    opponentProjected: opponentTeam.projectedPoints,
    userActual: userMatchup.points || 0,
    opponentActual: opponentMatchup.points || 0,
    userPlayerPoints: userMatchup.players_points || {},
    opponentPlayerPoints: opponentMatchup.players_points || {},
    playerProjections,
  };
}

/**
 * Get league standings
 */
export async function getLeagueStandings(leagueId: string): Promise<RosterWithPlayers[]> {
  const [rosters, leagueUsers] = await Promise.all([
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
  ]);
  
  // Sort by wins, then by points
  const sortedRosters = [...rosters].sort((a, b) => {
    if (b.settings.wins !== a.settings.wins) {
      return b.settings.wins - a.settings.wins;
    }
    return b.settings.fpts - a.settings.fpts;
  });
  
  // Get full details for each roster
  const standings = await Promise.all(
    sortedRosters.map(roster => getRosterWithPlayers(roster, leagueUsers))
  );
  
  return standings;
}

