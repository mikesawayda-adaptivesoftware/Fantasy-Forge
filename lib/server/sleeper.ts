/**
 * Server-only Sleeper access with an in-memory cache.
 *
 * Heavy/shared data (player database, weekly stats, schedule) is fetched and
 * trimmed here so browsers download a small fraction of Sleeper's payloads.
 * Next's fetch data cache can't store items over 2MB (the player DB is ~15MB),
 * so caching is done in-process instead.
 */
import {
  FANTASY_POSITIONS,
  NflState,
  Player,
  Position,
  SleeperGame,
  SleeperPlayer,
  StatsByPlayer,
  TeamSchedule,
  TrendingPlayer,
  WeeklyStatsPayload,
} from '@/types';
import { normalizeSchedule, REGULAR_SEASON_WEEKS, resolveSeasonContext, TEAM_NAMES } from '@/lib/nfl';
import { computeDefenseVsPosition, DefenseVsPositionResponse, WeeklyTeamStats } from '@/lib/matchups';

const SLEEPER_API = 'https://api.sleeper.app';
// Sleeper's (undocumented) web API: richer rows with team/opponent, injuries and live scores
const SLEEPER_WEB_API = 'https://api.sleeper.com';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

interface CacheEntry<T> {
  value?: T;
  expires: number;
  pending?: Promise<T>;
}

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 250;

/** Drop expired entries, then the soonest-to-expire ones if still over the cap */
function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (!entry.pending && entry.expires <= now) store.delete(key);
  }
  if (store.size <= MAX_ENTRIES) return;
  const settled = [...store.entries()].filter(([, e]) => !e.pending).sort((a, b) => a[1].expires - b[1].expires);
  for (const [key] of settled.slice(0, store.size - MAX_ENTRIES)) store.delete(key);
}

/**
 * Cache `loader` results for `ttlMs`. Concurrent callers share one request and
 * stale data is served (briefly) if a refresh fails.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry?.value !== undefined && entry.expires > now) return entry.value;
  if (entry?.pending) return entry.pending;

  const pending = loader()
    .then(value => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      evict();
      return value;
    })
    .catch(error => {
      if (entry?.value !== undefined) {
        console.warn(`[sleeper] refresh failed for ${key}, serving stale data`, error);
        store.set(key, { value: entry.value, expires: Date.now() + MINUTE });
        return entry.value;
      }
      store.delete(key);
      throw error;
    });

  store.set(key, { value: entry?.value, expires: entry?.expires ?? 0, pending });
  return pending;
}

export class SleeperError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function fetchSleeper<T>(path: string, base = SLEEPER_API): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new SleeperError(`Sleeper ${path} responded ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

// ==========================================
// STATE
// ==========================================

export function getNflState(): Promise<NflState> {
  return cached('state', 5 * MINUTE, () => fetchSleeper<NflState>('/v1/state/nfl'));
}

// ==========================================
// PLAYERS
// ==========================================

function transformPlayer(sleeper: SleeperPlayer): Player {
  const isDefense = sleeper.position === 'DEF';
  const team = sleeper.team || 'FA';
  const name = isDefense
    ? `${TEAM_NAMES[sleeper.player_id] ?? `${sleeper.first_name} ${sleeper.last_name}`} DEF`
    : sleeper.full_name || `${sleeper.first_name} ${sleeper.last_name}`;

  const player: Player = {
    id: sleeper.player_id,
    name,
    firstName: sleeper.first_name,
    lastName: sleeper.last_name,
    position: sleeper.position,
    team,
  };
  if (sleeper.age) player.age = sleeper.age;
  if (sleeper.years_exp !== undefined && sleeper.years_exp !== null) player.experience = sleeper.years_exp;
  if (sleeper.college) player.college = sleeper.college;
  if (sleeper.number) player.number = sleeper.number;
  if (sleeper.status) player.status = sleeper.status;
  if (sleeper.injury_status) player.injuryStatus = sleeper.injury_status;
  if (sleeper.injury_body_part) player.injuryBodyPart = sleeper.injury_body_part;
  if (sleeper.injury_notes) player.injuryNotes = sleeper.injury_notes;
  if (sleeper.search_rank) player.searchRank = sleeper.search_rank;
  return player;
}

export const IDP_POSITIONS: Position[] = ['DL', 'LB', 'DB'];
const PLAYER_POSITIONS: Position[] = [...FANTASY_POSITIONS, ...IDP_POSITIONS];

/**
 * Players on a team or still active, including IDP positions so IDP league
 * rosters display correctly. Sleeper asks that the full player dump be
 * requested sparingly, so it is refreshed at most twice a day; injuries are
 * refreshed separately (see getInjuries).
 */
export function getPlayers(): Promise<Player[]> {
  return cached('players', 12 * HOUR, async () => {
    const raw = await fetchSleeper<Record<string, SleeperPlayer>>('/v1/players/nfl');
    const players: Player[] = [];
    for (const id in raw) {
      const p = raw[id];
      if (!PLAYER_POSITIONS.includes(p.position as Position)) continue;
      if (!p.team && !p.active) continue;
      // IDP free agents are never needed
      if (!FANTASY_POSITIONS.includes(p.position as Position) && !p.team) continue;
      players.push(transformPlayer(p));
    }
    // Defenses have no search rank; slot them after skill players by team name
    let defenseRank = 500;
    return players
      .sort((a, b) => (a.searchRank ?? 9999) - (b.searchRank ?? 9999) || a.name.localeCompare(b.name))
      .map(p => (p.position === 'DEF' && !p.searchRank ? { ...p, searchRank: defenseRank++ } : p))
      .sort((a, b) => (a.searchRank ?? 9999) - (b.searchRank ?? 9999));
  });
}

const playerIdSets = new WeakMap<Player[], { fantasy: Set<string>; idp: Set<string> }>();

async function getPlayerIdSets() {
  const players = await getPlayers();
  let sets = playerIdSets.get(players);
  if (!sets) {
    sets = {
      fantasy: new Set(players.filter(p => FANTASY_POSITIONS.includes(p.position)).map(p => p.id)),
      idp: new Set(players.filter(p => IDP_POSITIONS.includes(p.position)).map(p => p.id)),
    };
    playerIdSets.set(players, sets);
  }
  return sets;
}

// ==========================================
// INJURIES
// ==========================================

export interface InjuryInfo {
  status: string | null;
  bodyPart: string | null;
  notes: string | null;
  updatedAt: number | null;
}

interface SleeperWeeklyRow {
  player_id: string;
  team?: string | null;
  opponent?: string | null;
  stats?: Record<string, unknown>;
  player?: {
    position?: string;
    injury_status?: string | null;
    injury_body_part?: string | null;
    injury_notes?: string | null;
    news_updated?: number | null;
  } | null;
}

/**
 * Current injury designations. Sleeper's weekly projection rows embed each
 * player's live injury fields, so this is far fresher than the twice-daily
 * player dump without calling that endpoint more often.
 */
export function getInjuries(): Promise<Map<string, InjuryInfo>> {
  return cached('injuries', 20 * MINUTE, async () => {
    const ctx = resolveSeasonContext(await getNflState());
    const rows = await fetchSleeper<SleeperWeeklyRow[] | null>(
      `/projections/nfl/${ctx.season}/${ctx.week}?season_type=regular`,
      SLEEPER_WEB_API
    );
    const injuries = new Map<string, InjuryInfo>();
    for (const row of rows ?? []) {
      if (!row.player) continue;
      injuries.set(row.player_id, {
        status: row.player.injury_status ?? null,
        bodyPart: row.player.injury_body_part ?? null,
        notes: row.player.injury_notes ?? null,
        updatedAt: row.player.news_updated ?? null,
      });
    }
    return injuries;
  });
}

const mergedPlayers = new WeakMap<Player[], { injuries: Map<string, InjuryInfo>; players: Player[] }>();

/** Player list with fresh injury data overlaid (memoized per data refresh) */
export async function getPlayersWithInjuries(): Promise<Player[]> {
  const players = await getPlayers();
  const injuries = await getInjuries().catch(() => null);
  if (!injuries || injuries.size === 0) return players;
  const hit = mergedPlayers.get(players);
  if (hit && hit.injuries === injuries) return hit.players;

  const merged = players.map(player => {
    const injury = injuries.get(player.id);
    if (!injury) return player;
    const next: Player = { ...player };
    delete next.injuryStatus;
    delete next.injuryBodyPart;
    delete next.injuryNotes;
    delete next.injuryUpdatedAt;
    if (injury.status) {
      next.injuryStatus = injury.status;
      if (injury.bodyPart) next.injuryBodyPart = injury.bodyPart;
      if (injury.notes) next.injuryNotes = injury.notes;
      if (injury.updatedAt) next.injuryUpdatedAt = injury.updatedAt;
    }
    return next;
  });
  mergedPlayers.set(players, { injuries, players: merged });
  return merged;
}

// ==========================================
// SCHEDULE & LIVE SCORES
// ==========================================

/** Is `season` the season currently being played? */
export async function isLiveSeason(season: string): Promise<boolean> {
  try {
    const state = await getNflState();
    return season === state.season && (state.season_type === 'regular' || state.season_type === 'post');
  } catch {
    return true;
  }
}

/**
 * Allowed seasons for public routes: the current season and the two before it
 * (enough for game logs and matchup priors) – keeps the cache bounded.
 */
export async function isSupportedSeason(season: string): Promise<boolean> {
  const state = await getNflState();
  const current = Number(state.season);
  const n = Number(season);
  return n >= current - 2 && n <= current;
}

export async function getSchedule(season: string): Promise<TeamSchedule> {
  const ttl = (await isLiveSeason(season)) ? 10 * MINUTE : HOUR;
  return cached(`schedule:${season}`, ttl, async () => {
    const games = await fetchSleeper<SleeperGame[]>(`/schedule/nfl/regular/${season}`);
    return normalizeSchedule(Array.isArray(games) ? games : []);
  });
}

interface SleeperScoreGame {
  status?: string;
  metadata?: {
    home_team?: string;
    away_team?: string;
    date_time?: string;
    home_score?: number;
    away_score?: number;
    quarter?: string;
    time_remaining?: string;
    is_in_progress?: boolean;
    is_over?: boolean;
  } | null;
}

/** Live game status, kickoff time and score for one week (short cache) */
export function getWeekScores(season: string, week: number): Promise<SleeperScoreGame[]> {
  return cached(`scores:${season}:${week}`, MINUTE, async () => {
    const games = await fetchSleeper<SleeperScoreGame[] | null>(`/scores/nfl/regular/${season}/${week}`, SLEEPER_WEB_API);
    return Array.isArray(games) ? games : [];
  });
}

/**
 * Schedule with kickoff times, live status and scores overlaid for the
 * current and next week. Kickoff times make lineup locks exact.
 */
export async function getLiveSchedule(season: string): Promise<TeamSchedule> {
  const schedule = await getSchedule(season);
  if (!(await isLiveSeason(season))) return schedule;
  const ctx = resolveSeasonContext(await getNflState());
  const weeks = [ctx.week, ctx.week + 1].filter(w => w <= REGULAR_SEASON_WEEKS);
  const scoreWeeks = await Promise.all(weeks.map(week => getWeekScores(season, week).catch(() => [])));
  return applyLiveScores(schedule, weeks.map((week, i) => ({ week, games: scoreWeeks[i] })));
}

export function applyLiveScores(schedule: TeamSchedule, weeks: { week: number; games: SleeperScoreGame[] }[]): TeamSchedule {
  const next: TeamSchedule = { ...schedule };
  for (const { week, games } of weeks) {
    for (const game of games) {
      const m = game.metadata;
      if (!m?.home_team || !m.away_team) continue;
      const status = m.is_over ? 'complete' : m.is_in_progress ? 'in_game' : game.status ?? 'pre_game';
      for (const [team, isHome] of [[m.home_team, true], [m.away_team, false]] as const) {
        const existing = next[team]?.[week];
        if (!existing) continue;
        next[team] = { ...next[team] };
        next[team][week] = {
          ...existing,
          status,
          kickoff: m.date_time ?? existing.kickoff,
          teamScore: isHome ? m.home_score : m.away_score,
          opponentScore: isHome ? m.away_score : m.home_score,
          clock: status === 'in_game' && m.quarter ? `Q${m.quarter} ${m.time_remaining ?? ''}`.trim() : undefined,
        };
      }
    }
  }
  return next;
}

// ==========================================
// WEEKLY STATS & PROJECTIONS
// ==========================================

// Ranking/ADP fields aren't used by scoring and bloat the payload
const DROPPED_STAT_PREFIXES = ['pos_rank_', 'rank_', 'adp_', 'pos_adp_'];

async function weeklyTtl(season: string, week: number): Promise<number> {
  try {
    const ctx = resolveSeasonContext(await getNflState());
    const isPast = Number(season) < Number(ctx.season) || (season === ctx.season && week < ctx.week);
    return isPast ? 12 * HOUR : 2 * MINUTE;
  } catch {
    return 2 * MINUTE;
  }
}

function trimStatLine(line: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key in line) {
    const value = line[key];
    if (typeof value !== 'number' || DROPPED_STAT_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
    out[key] = value;
  }
  return out;
}

async function idsFor(idp: boolean): Promise<Set<string>> {
  const sets = await getPlayerIdSets();
  return idp ? sets.idp : sets.fantasy;
}

const POSITION_QUERY = {
  fantasy: FANTASY_POSITIONS.map(p => `position[]=${p}`).join('&'),
  idp: IDP_POSITIONS.map(p => `position[]=${p}`).join('&'),
};

/**
 * Weekly stats with each player's team and opponent for that week, so game
 * logs and matchup ratings stay correct for traded players. Falls back to the
 * documented v1 endpoint (without teams) if Sleeper's web API is unavailable.
 */
export async function getWeeklyStats(season: string, week: number, idp = false): Promise<WeeklyStatsPayload> {
  const ttl = await weeklyTtl(season, week);
  return cached(`stats:${season}:${week}:${idp ? 'idp' : 'off'}`, ttl, async () => {
    const ids = await idsFor(idp);
    const payload: WeeklyStatsPayload = { stats: {}, teams: {} };
    try {
      const rows = await fetchSleeper<SleeperWeeklyRow[] | null>(
        `/stats/nfl/${season}/${week}?season_type=regular&${idp ? POSITION_QUERY.idp : POSITION_QUERY.fantasy}`,
        SLEEPER_WEB_API
      );
      for (const row of rows ?? []) {
        if (!ids.has(row.player_id) || !row.stats) continue;
        payload.stats[row.player_id] = trimStatLine(row.stats);
        if (row.team && row.opponent) payload.teams[row.player_id] = [row.team, row.opponent];
      }
      return payload;
    } catch (error) {
      console.warn(`[sleeper] web stats failed for ${season} week ${week}, using v1`, error);
      const raw = await fetchSleeper<Record<string, Record<string, unknown>> | null>(`/v1/stats/nfl/regular/${season}/${week}`);
      for (const playerId in raw ?? {}) {
        if (ids.has(playerId)) payload.stats[playerId] = trimStatLine(raw![playerId]);
      }
      return payload;
    }
  });
}

/** Weekly projections for fantasy-relevant (or IDP) players */
export async function getWeeklyProjections(season: string, week: number, idp = false): Promise<StatsByPlayer> {
  const ttl = await weeklyTtl(season, week);
  return cached(`projections:${season}:${week}:${idp ? 'idp' : 'off'}`, ttl, async () => {
    const [raw, ids] = await Promise.all([
      fetchSleeper<Record<string, Record<string, unknown>> | null>(`/v1/projections/nfl/regular/${season}/${week}`),
      idsFor(idp),
    ]);
    const trimmed: StatsByPlayer = {};
    for (const playerId in raw ?? {}) {
      if (ids.has(playerId)) trimmed[playerId] = trimStatLine(raw![playerId]);
    }
    return trimmed;
  });
}

// ==========================================
// DEFENSE VS POSITION
// ==========================================

async function seasonTeamStats(season: string, throughWeek: number): Promise<WeeklyTeamStats[]> {
  const schedule = await getSchedule(season).catch(() => null);
  const weeks = Array.from({ length: throughWeek }, (_, i) => i + 1);
  const results = await Promise.all(
    weeks.map(week =>
      getWeeklyStats(season, week)
        .then((payload): WeeklyTeamStats => ({ week, stats: payload.stats, schedule }))
        .catch(() => null)
    )
  );
  return results.filter((r): r is WeeklyTeamStats => r !== null);
}

export function getDefenseVsPosition(): Promise<DefenseVsPositionResponse> {
  return cached('dvp', HOUR, async () => {
    const state = await getNflState();
    const ctx = resolveSeasonContext(state);
    const currentSeason = ctx.statsSeason;
    const current = await seasonTeamStats(currentSeason, ctx.statsThroughWeek);
    const priorSeason = String(Number(currentSeason) - 1);
    const previous = await seasonTeamStats(priorSeason, REGULAR_SEASON_WEEKS);
    const PRIOR_GAMES = 3;
    return {
      season: currentSeason,
      priorSeason: previous.length ? priorSeason : null,
      previousTeams: previous.length ? computeDefenseVsPosition(previous, [], 0) : null,
      priorGames: PRIOR_GAMES,
      teams: computeDefenseVsPosition(current, previous, PRIOR_GAMES),
    };
  });
}

// ==========================================
// TRENDING
// ==========================================

export function getTrending(type: 'add' | 'drop', lookbackHours: number, limit: number): Promise<TrendingPlayer[]> {
  return cached(`trending:${type}:${lookbackHours}:${limit}`, 15 * MINUTE, () =>
    fetchSleeper<TrendingPlayer[]>(`/v1/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`)
  );
}
