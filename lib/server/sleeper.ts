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
} from '@/types';
import { normalizeSchedule, REGULAR_SEASON_WEEKS, resolveSeasonContext, TEAM_NAMES } from '@/lib/nfl';
import { computeDefenseVsPosition, DefenseVsPositionResponse, WeeklyTeamStats } from '@/lib/matchups';

const SLEEPER_API = 'https://api.sleeper.app';

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

async function fetchSleeper<T>(path: string): Promise<T> {
  const response = await fetch(`${SLEEPER_API}${path}`, {
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
  if (sleeper.search_rank) player.searchRank = sleeper.search_rank;
  return player;
}

const PLAYER_POSITIONS: Position[] = [...FANTASY_POSITIONS, 'DL', 'LB', 'DB'];

/**
 * Players on a team or still active, including IDP positions so IDP league
 * rosters display correctly. Sleeper asks that the full player dump be
 * requested sparingly, so it is refreshed at most twice a day.
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

const playerIdSets = new WeakMap<Player[], Set<string>>();

async function getFantasyPlayerIds(): Promise<Set<string>> {
  const players = await getPlayers();
  let ids = playerIdSets.get(players);
  if (!ids) {
    ids = new Set(players.filter(p => FANTASY_POSITIONS.includes(p.position)).map(p => p.id));
    playerIdSets.set(players, ids);
  }
  return ids;
}

// ==========================================
// SCHEDULE
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
  // Game status is the kickoff signal for lineup locks, so keep it fresh in season
  const ttl = (await isLiveSeason(season)) ? 90_000 : HOUR;
  return cached(`schedule:${season}`, ttl, async () => {
    const games = await fetchSleeper<SleeperGame[]>(`/schedule/nfl/regular/${season}`);
    return normalizeSchedule(Array.isArray(games) ? games : []);
  });
}

// ==========================================
// WEEKLY STATS & PROJECTIONS
// ==========================================

export type WeeklyKind = 'stats' | 'projections';

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

/** Weekly stats or projections for fantasy-relevant players only */
export async function getWeekly(kind: WeeklyKind, season: string, week: number): Promise<StatsByPlayer> {
  const ttl = await weeklyTtl(season, week);
  return cached(`${kind}:${season}:${week}`, ttl, async () => {
    const [raw, ids] = await Promise.all([
      fetchSleeper<StatsByPlayer | null>(`/v1/${kind}/nfl/regular/${season}/${week}`),
      getFantasyPlayerIds(),
    ]);
    const trimmed: StatsByPlayer = {};
    if (!raw) return trimmed;
    for (const playerId in raw) {
      if (!ids.has(playerId)) continue;
      const line = raw[playerId];
      const out: Record<string, number> = {};
      for (const key in line) {
        const value = line[key];
        if (typeof value !== 'number' || DROPPED_STAT_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
        out[key] = value;
      }
      trimmed[playerId] = out;
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
      getWeekly('stats', season, week)
        .then((stats): WeeklyTeamStats => ({ week, stats, schedule }))
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
