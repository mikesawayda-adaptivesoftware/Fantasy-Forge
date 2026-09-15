import { SleeperMatchup, SleeperRoster } from '@/types';
import { rosterPoints, WeeklyScores, winPct } from './power-rankings';

export interface ScheduledWeek {
  week: number;
  /** Head-to-head pairs of roster IDs; empty when the schedule isn't published */
  pairs: [number, number][];
}

export interface PlayoffOddsRow {
  rosterId: number;
  playoffPct: number;
  byePct: number;
  firstSeedPct: number;
  averageSeed: number | null;
  projectedWins: number;
  /** Mean and standard deviation of weekly points used for the simulation */
  strength: { mean: number; sd: number };
  clinched: boolean;
  eliminated: boolean;
}

export interface PlayoffOddsInput {
  rosters: SleeperRoster[];
  completed: WeeklyScores[];
  remaining: ScheduledWeek[];
  playoffTeams: number;
  /** League plays an extra game each week against the league median */
  medianGame?: boolean;
  simulations?: number;
  seed?: number;
}

/** Deterministic PRNG so results (and tests) are reproducible */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number): number {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** Pairs of roster IDs from a week's matchups */
export function toScheduledWeek(week: number, matchups: SleeperMatchup[]): ScheduledWeek {
  const byMatchup = new Map<number, number[]>();
  for (const m of matchups) {
    if (m.matchup_id === null || m.matchup_id === undefined) continue;
    const list = byMatchup.get(m.matchup_id) ?? [];
    list.push(m.roster_id);
    byMatchup.set(m.matchup_id, list);
  }
  const pairs: [number, number][] = [];
  byMatchup.forEach(ids => {
    if (ids.length === 2) pairs.push([ids[0], ids[1]]);
  });
  return { week, pairs };
}

/** Number of first-round byes for a bracket size (6 teams → 2 byes) */
export function byeCount(playoffTeams: number): number {
  if (playoffTeams <= 1) return 0;
  const bracket = 2 ** Math.ceil(Math.log2(playoffTeams));
  return bracket - playoffTeams;
}

/**
 * Monte Carlo playoff odds. Each team's weekly score is drawn from a normal
 * distribution around its season average (shrunk toward the league average
 * early on). Remaining head-to-head games come from the league schedule;
 * unpublished weeks use random pairings. Seeds are ordered by win % then
 * points for, like Sleeper's default tiebreakers (divisions are ignored).
 */
export function simulatePlayoffOdds(input: PlayoffOddsInput): PlayoffOddsRow[] {
  const { rosters, completed, remaining, playoffTeams, medianGame = false, simulations = 5000, seed = 20260914 } = input;
  const random = mulberry32(seed);
  const ids = rosters.map(r => r.roster_id);
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));

  // Team strength
  const allScores = completed.flatMap(w => Object.values(w.scores));
  const leagueMean = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 100;
  const leagueSd = allScores.length > 1 ? Math.sqrt(allScores.reduce((s, v) => s + (v - leagueMean) ** 2, 0) / (allScores.length - 1)) : 20;
  const SHRINK_GAMES = 3;
  const strength = ids.map(id => {
    const scores = completed.map(w => w.scores[id]).filter((v): v is number => typeof v === 'number');
    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = (sum + leagueMean * SHRINK_GAMES) / (scores.length + SHRINK_GAMES);
    const variance = scores.length > 1 ? scores.reduce((s, v) => s + (v - sum / scores.length) ** 2, 0) / (scores.length - 1) : leagueSd ** 2;
    // Blend team and league variance so a few steady weeks don't imply certainty
    const sd = Math.sqrt((variance * scores.length + leagueSd ** 2 * SHRINK_GAMES) / (scores.length + SHRINK_GAMES));
    return { mean, sd: Math.max(sd, 5) };
  });

  const baseWins = rosters.map(r => r.settings.wins + r.settings.ties * 0.5);
  const baseGames = rosters.map(r => r.settings.wins + r.settings.losses + r.settings.ties);
  const basePoints = rosters.map(r => rosterPoints(r.settings.fpts, r.settings.fpts_decimal));

  const playoffs = new Array(n).fill(0);
  const byes = new Array(n).fill(0);
  const firstSeeds = new Array(n).fill(0);
  const seedSums = new Array(n).fill(0);
  const winSums = new Array(n).fill(0);
  const byeSlots = Math.min(byeCount(playoffTeams), playoffTeams);

  const wins = new Float64Array(n);
  const games = new Float64Array(n);
  const points = new Float64Array(n);
  const weekScores = new Float64Array(n);
  const order = ids.map((_, i) => i);

  for (let sim = 0; sim < simulations; sim++) {
    for (let i = 0; i < n; i++) {
      wins[i] = baseWins[i];
      games[i] = baseGames[i];
      points[i] = basePoints[i];
    }

    for (const week of remaining) {
      for (let i = 0; i < n; i++) {
        weekScores[i] = strength[i].mean + strength[i].sd * normal(random);
        points[i] += weekScores[i];
      }

      let pairs = week.pairs.map(([a, b]) => [index.get(a), index.get(b)] as const).filter(([a, b]) => a !== undefined && b !== undefined) as [number, number][];
      if (pairs.length === 0) {
        // Schedule not published: random pairings
        const shuffled = [...order];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        pairs = [];
        for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
      }
      for (const [a, b] of pairs) {
        games[a]++;
        games[b]++;
        if (weekScores[a] > weekScores[b]) wins[a]++;
        else if (weekScores[b] > weekScores[a]) wins[b]++;
        else {
          wins[a] += 0.5;
          wins[b] += 0.5;
        }
      }

      if (medianGame) {
        const sorted = Array.from(weekScores).sort((x, y) => x - y);
        const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
        for (let i = 0; i < n; i++) {
          games[i]++;
          if (weekScores[i] > median) wins[i]++;
        }
      }
    }

    const ranked = [...order].sort((a, b) => {
      const pctA = games[a] ? wins[a] / games[a] : 0;
      const pctB = games[b] ? wins[b] / games[b] : 0;
      return pctB - pctA || points[b] - points[a];
    });
    ranked.forEach((team, position) => {
      const seedNumber = position + 1;
      winSums[team] += wins[team];
      if (seedNumber <= playoffTeams) {
        playoffs[team]++;
        seedSums[team] += seedNumber;
        if (seedNumber <= byeSlots) byes[team]++;
        if (seedNumber === 1) firstSeeds[team]++;
      }
    });
  }

  return ids.map((rosterId, i) => {
    const playoffPct = (playoffs[i] / simulations) * 100;
    return {
      rosterId,
      playoffPct: Math.round(playoffPct * 10) / 10,
      byePct: Math.round((byes[i] / simulations) * 1000) / 10,
      firstSeedPct: Math.round((firstSeeds[i] / simulations) * 1000) / 10,
      averageSeed: playoffs[i] ? Math.round((seedSums[i] / playoffs[i]) * 10) / 10 : null,
      projectedWins: Math.round((winSums[i] / simulations) * 10) / 10,
      strength: { mean: Math.round(strength[i].mean * 10) / 10, sd: Math.round(strength[i].sd * 10) / 10 },
      clinched: playoffs[i] === simulations,
      eliminated: playoffs[i] === 0,
    };
  });
}

/** Rows sorted for display: playoff odds, then average seed, then record */
export function sortOdds(rows: PlayoffOddsRow[], rosters: SleeperRoster[]): PlayoffOddsRow[] {
  const byId = new Map(rosters.map(r => [r.roster_id, r]));
  return [...rows].sort((a, b) => {
    const ra = byId.get(a.rosterId)!.settings;
    const rb = byId.get(b.rosterId)!.settings;
    return (
      b.playoffPct - a.playoffPct ||
      (a.averageSeed ?? 99) - (b.averageSeed ?? 99) ||
      winPct(rb.wins, rb.losses, rb.ties) - winPct(ra.wins, ra.losses, ra.ties) ||
      b.projectedWins - a.projectedWins
    );
  });
}
