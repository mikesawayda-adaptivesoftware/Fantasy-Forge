/**
 * Direct (browser -> Sleeper) calls for user and league data. These payloads
 * are small and user-specific, so they skip our server entirely – your
 * Sleeper username never touches FantasyForge's backend.
 */
import {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperRoster,
  SleeperUser,
  UserLeague,
} from '@/types';
import { ApiError, fetchJson } from './api';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const LEAGUE_TTL = 60_000;

export async function getUserByUsername(username: string): Promise<SleeperUser | null> {
  const user = await fetchJson<SleeperUser | null>(
    `${SLEEPER_BASE_URL}/user/${encodeURIComponent(username.trim())}`,
    10 * 60_000
  ).catch(error => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  return user && user.user_id ? user : null;
}

export async function getUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  const leagues = await fetchJson<SleeperLeague[] | null>(
    `${SLEEPER_BASE_URL}/user/${userId}/leagues/nfl/${season}`,
    LEAGUE_TTL
  );
  return leagues ?? [];
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  return fetchJson<SleeperLeague | null>(`${SLEEPER_BASE_URL}/league/${leagueId}`, LEAGUE_TTL).catch(error => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (await fetchJson<SleeperRoster[] | null>(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`, LEAGUE_TTL)) ?? [];
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return (await fetchJson<SleeperLeagueUser[] | null>(`${SLEEPER_BASE_URL}/league/${leagueId}/users`, LEAGUE_TTL)) ?? [];
}

export async function getLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return (await fetchJson<SleeperMatchup[] | null>(`${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`, LEAGUE_TTL)) ?? [];
}

export async function getUserLeaguesWithContext(userId: string, season: string): Promise<UserLeague[]> {
  const leagues = await getUserLeagues(userId, season);
  return Promise.all(
    leagues.map(async league => {
      const rosters = await getLeagueRosters(league.league_id).catch(() => []);
      const userRoster = rosters.find(r => r.owner_id === userId || r.co_owners?.includes(userId));
      return {
        ...league,
        userRosterId: userRoster?.roster_id,
        userRecord: userRoster
          ? { wins: userRoster.settings.wins, losses: userRoster.settings.losses, ties: userRoster.settings.ties }
          : undefined,
      };
    })
  );
}

export function getTeamName(user: SleeperLeagueUser | null | undefined, rosterId: number): string {
  return user?.metadata?.team_name || user?.display_name || `Team ${rosterId}`;
}
