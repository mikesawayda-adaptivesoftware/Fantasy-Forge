/**
 * Synthetic Sleeper data for browser tests. Everything the browser fetches is
 * mocked (our /api/nfl routes and api.sleeper.app), so tests are fast and
 * deterministic and never depend on the live NFL calendar.
 */
import type { Page, Route } from '@playwright/test';
import { SCORING_PRESETS } from '../../lib/points';

export const USERNAME = 'forge_tester';
const LEAGUE_ID = '9000000001';
const WEEK = 5;
const SEASON = '2026';

type P = { id: string; name: string; position: string; team: string; searchRank: number; injuryStatus?: string; injuryBodyPart?: string; age?: number };

export const PLAYERS: P[] = [
  { id: '1001', name: 'Josh Allen', position: 'QB', team: 'BUF', searchRank: 1, age: 30 },
  { id: '1002', name: 'Patrick Mahomes', position: 'QB', team: 'KC', searchRank: 2, age: 31 },
  { id: '1003', name: 'Bijan Robinson', position: 'RB', team: 'ATL', searchRank: 3, age: 24 },
  { id: '1004', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', searchRank: 4, age: 24 },
  { id: '1005', name: 'Backup Runner', position: 'RB', team: 'MIA', searchRank: 40, age: 27 },
  { id: '1006', name: "Ja'Marr Chase", position: 'WR', team: 'CIN', searchRank: 5, age: 26 },
  { id: '1007', name: 'Justin Jefferson', position: 'WR', team: 'MIN', searchRank: 6, injuryStatus: 'Out', injuryBodyPart: 'Hamstring', age: 27 },
  { id: '1008', name: 'Waiver Receiver', position: 'WR', team: 'NYJ', searchRank: 30, age: 25 },
  { id: '1009', name: 'Trending Wideout', position: 'WR', team: 'SEA', searchRank: 60, age: 23 },
  { id: '1010', name: 'Brock Bowers', position: 'TE', team: 'LV', searchRank: 7, age: 23 },
  { id: '1011', name: 'Spare Tight End', position: 'TE', team: 'NE', searchRank: 80, age: 29 },
  { id: 'KC', name: 'Kansas City Chiefs DEF', position: 'DEF', team: 'KC', searchRank: 500 },
  { id: 'BUF', name: 'Buffalo Bills DEF', position: 'DEF', team: 'BUF', searchRank: 501 },
];

// Weekly opponents (MIN is on bye in week 5)
const OPPONENTS: Record<string, string[]> = {
  BUF: ['NYJ', 'MIA', 'NE', 'KC', 'ATL'],
  KC: ['LV', 'CIN', 'DET', 'BUF', 'SEA'],
  ATL: ['DET', 'NE', 'MIA', 'SEA', 'BUF'],
  DET: ['ATL', 'MIN', 'KC', 'LV', 'NYJ'],
  MIA: ['NE', 'BUF', 'ATL', 'CIN', 'LV'],
  CIN: ['SEA', 'KC', 'LV', 'MIA', 'NE'],
  MIN: ['MIA', 'DET', 'SEA', 'NYJ', ''],
  NYJ: ['BUF', 'LV', 'CIN', 'MIN', 'DET'],
  SEA: ['CIN', 'NYJ', 'MIN', 'ATL', 'KC'],
  LV: ['KC', 'NYJ', 'CIN', 'DET', 'MIA'],
  NE: ['MIA', 'ATL', 'BUF', 'CIN', 'CIN'],
};

function schedule() {
  const result: Record<string, Record<number, object>> = {};
  for (const team of Object.keys(OPPONENTS)) {
    result[team] = {};
    OPPONENTS[team].forEach((opponent, i) => {
      if (!opponent) return;
      const week = i + 1;
      result[team][week] = {
        opponent,
        home: team < opponent,
        date: week < WEEK ? `2026-10-0${week}` : '2099-10-05',
        status: week < WEEK ? 'complete' : 'pre_game',
      };
    });
  }
  return result;
}

const WEEKLY_LINES: Record<string, Record<string, number>> = {
  '1001': { gp: 1, pass_yd: 280, pass_td: 3, rush_yd: 30 },
  '1002': { gp: 1, pass_yd: 250, pass_td: 2 },
  '1003': { gp: 1, rush_yd: 95, rush_td: 1, rec: 4, rec_yd: 30 },
  '1004': { gp: 1, rush_yd: 80, rec: 5, rec_yd: 40, rush_td: 1 },
  '1005': { gp: 1, rush_yd: 35, rec: 1, rec_yd: 5 },
  '1006': { gp: 1, rec: 8, rec_yd: 105, rec_td: 1 },
  '1007': { gp: 1, rec: 7, rec_yd: 95 },
  '1008': { gp: 1, rec: 6, rec_yd: 80, rec_td: 1 },
  '1009': { gp: 1, rec: 5, rec_yd: 70 },
  '1010': { gp: 1, rec: 6, rec_yd: 70 },
  '1011': { gp: 1, rec: 2, rec_yd: 15 },
  KC: { gp: 1, sack: 3, int: 1, pts_allow_14_20: 1 },
  BUF: { gp: 1, sack: 2, pts_allow_21_27: 1 },
};

function weeklyStats(week: number) {
  const stats: Record<string, Record<string, number>> = {};
  const teams: Record<string, [string, string]> = {};
  for (const p of PLAYERS) {
    const opponent = OPPONENTS[p.team]?.[week - 1];
    if (!opponent) continue;
    stats[p.id] = WEEKLY_LINES[p.id];
    teams[p.id] = [p.team, opponent];
  }
  return { stats, teams };
}

function projections() {
  const proj: Record<string, Record<string, number>> = {};
  for (const p of PLAYERS) {
    if (!OPPONENTS[p.team]?.[WEEK - 1]) continue; // bye
    proj[p.id] = { ...WEEKLY_LINES[p.id] };
  }
  return proj;
}

const LEAGUE = {
  league_id: LEAGUE_ID,
  name: 'Forge Test League',
  status: 'in_season',
  sport: 'nfl',
  season: SEASON,
  season_type: 'regular',
  total_rosters: 2,
  roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DEF', 'BN', 'BN', 'BN'],
  settings: { type: 0, playoff_teams: 2, playoff_week_start: 15, start_week: 1, last_scored_leg: WEEK - 1, draft_rounds: 4 },
  scoring_settings: SCORING_PRESETS.ppr,
  avatar: null,
  draft_id: null,
  previous_league_id: null,
};

const ROSTERS = [
  {
    roster_id: 1,
    owner_id: 'u1',
    league_id: LEAGUE_ID,
    // Jefferson (Out, on bye) is starting while Chase sits on the bench
    players: ['1001', '1003', '1005', '1006', '1007', '1010', 'KC'],
    starters: ['1001', '1003', '1007', '1010', '1005', 'KC'],
    reserve: null,
    taxi: null,
    settings: { wins: 3, losses: 1, ties: 0, fpts: 480, fpts_decimal: 50, fpts_against: 430, ppts: 520 },
  },
  {
    roster_id: 2,
    owner_id: 'u2',
    league_id: LEAGUE_ID,
    players: ['1002', '1004', '1011'],
    starters: ['1002', '1004', '0', '1011', '0', '0'],
    reserve: null,
    taxi: null,
    settings: { wins: 1, losses: 3, ties: 0, fpts: 400, fpts_decimal: 0, fpts_against: 450, ppts: 470 },
  },
];

const USERS = [
  { user_id: 'u1', username: USERNAME, display_name: 'Forge Tester', avatar: null, metadata: { team_name: 'Forge FC' } },
  { user_id: 'u2', username: 'rival', display_name: 'Rival', avatar: null, metadata: { team_name: 'Rival Squad' } },
];

function matchups(week: number) {
  const scored = week < WEEK;
  return ROSTERS.map((r, i) => ({
    roster_id: r.roster_id,
    matchup_id: 1,
    players: r.players,
    starters: r.starters,
    points: scored ? (i === 0 ? 120 + week : 100 + week * 2) : 0,
    players_points: {},
  }));
}

const TRANSACTIONS = [
  {
    transaction_id: 't1',
    type: 'free_agent',
    status: 'complete',
    created: Date.UTC(2026, 9, 6),
    status_updated: Date.UTC(2026, 9, 6),
    leg: WEEK,
    roster_ids: [2],
    adds: { '1011': 2 },
    drops: null,
    draft_picks: [],
    waiver_budget: [],
  },
];

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

export async function mockApis(page: Page) {
  // Headshots and logos: keep tests offline (the UI falls back to initials)
  await page.route(/sleepercdn\.com/, route => route.abort());

  await page.route('**/api/nfl/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/nfl/state')
      return json(route, { week: WEEK, season: SEASON, season_type: 'regular', display_week: WEEK, league_season: SEASON, previous_season: '2025', season_start_date: '2026-09-09', season_has_scores: true });
    if (path === '/api/nfl/players') return json(route, PLAYERS.map(p => ({ ...p, firstName: p.name.split(' ')[0], lastName: p.name.split(' ').slice(1).join(' '), status: 'Active' })));
    if (path.startsWith('/api/nfl/schedule/')) return json(route, schedule());
    if (path === '/api/nfl/defense') return json(route, { season: SEASON, priorSeason: null, priorGames: 3, teams: {}, previousTeams: null });
    if (path === '/api/nfl/trending') return json(route, [{ player_id: '1009', count: 51234 }, { player_id: '1008', count: 20345 }]);
    const weekly = path.match(/^\/api\/nfl\/weekly\/(stats|projections)\/\d{4}\/(\d+)$/);
    if (weekly) {
      const week = Number(weekly[2]);
      if (url.searchParams.get('idp')) return json(route, weekly[1] === 'stats' ? { stats: {}, teams: {} } : {});
      return json(route, weekly[1] === 'stats' ? (week < WEEK ? weeklyStats(week) : { stats: {}, teams: {} }) : week === WEEK ? projections() : {});
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.route('https://api.sleeper.app/v1/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/v1', '');
    if (path === `/user/${USERNAME}`) return json(route, USERS[0]);
    if (path === `/user/u1/leagues/nfl/${SEASON}`) return json(route, [LEAGUE]);
    if (path === `/league/${LEAGUE_ID}`) return json(route, LEAGUE);
    if (path === `/league/${LEAGUE_ID}/rosters`) return json(route, ROSTERS);
    if (path === `/league/${LEAGUE_ID}/users`) return json(route, USERS);
    if (path === `/league/${LEAGUE_ID}/traded_picks`) return json(route, []);
    const m = path.match(/^\/league\/\d+\/matchups\/(\d+)$/);
    if (m) return json(route, matchups(Number(m[1])));
    const t = path.match(/^\/league\/\d+\/transactions\/(\d+)$/);
    if (t) return json(route, Number(t[1]) === WEEK ? TRANSACTIONS : []);
    return json(route, null);
  });
}

export async function signIn(page: Page) {
  await page.addInitScript(username => localStorage.setItem('sleeper_username', username), USERNAME);
}

export { LEAGUE_ID };
