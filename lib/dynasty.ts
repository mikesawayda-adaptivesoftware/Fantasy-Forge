import { Player, SleeperLeague, SleeperRoster } from '@/types';

/**
 * Dynasty value multipliers by age. These are heuristics based on the widely
 * used fantasy aging curves (RBs decline earliest, QBs latest); tune them here.
 */
const AGE_CURVES: Record<string, { age: number; multiplier: number }[]> = {
  RB: [{ age: 24, multiplier: 1.2 }, { age: 25, multiplier: 1.1 }, { age: 26, multiplier: 1.0 }, { age: 27, multiplier: 0.9 }, { age: 28, multiplier: 0.75 }, { age: 99, multiplier: 0.6 }],
  WR: [{ age: 25, multiplier: 1.15 }, { age: 27, multiplier: 1.05 }, { age: 28, multiplier: 1.0 }, { age: 29, multiplier: 0.9 }, { age: 30, multiplier: 0.8 }, { age: 99, multiplier: 0.65 }],
  TE: [{ age: 26, multiplier: 1.15 }, { age: 28, multiplier: 1.05 }, { age: 29, multiplier: 1.0 }, { age: 30, multiplier: 0.9 }, { age: 31, multiplier: 0.8 }, { age: 99, multiplier: 0.65 }],
  QB: [{ age: 27, multiplier: 1.15 }, { age: 30, multiplier: 1.05 }, { age: 33, multiplier: 1.0 }, { age: 35, multiplier: 0.85 }, { age: 99, multiplier: 0.7 }],
};

export function dynastyAgeMultiplier(player: Pick<Player, 'position' | 'age' | 'experience'>): number {
  const curve = AGE_CURVES[player.position];
  if (!curve || !player.age) return 1;
  const step = curve.find(s => player.age! <= s.age) ?? curve[curve.length - 1];
  // Rookies carry extra upside that a season of stats doesn't show yet
  const rookieBonus = player.experience === 0 ? 1.1 : 1;
  return Math.round(step.multiplier * rookieBonus * 100) / 100;
}

// ==========================================
// DRAFT PICKS
// ==========================================

export interface DraftPick {
  /** Stable key: season-round-originalRosterId */
  id: string;
  season: string;
  round: number;
  /** Roster whose pick this originally was (determines draft slot) */
  originalRosterId: number;
  /** Roster that owns it now */
  ownerRosterId: number;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  /** Original owner's roster */
  roster_id: number;
  /** Current owner's roster */
  owner_id: number;
  previous_owner_id: number;
}

export function pickId(season: string, round: number, originalRosterId: number): string {
  return `${season}-${round}-${originalRosterId}`;
}

/**
 * All picks for the next `seasons` drafts, applying trades. Each roster starts
 * with its own pick in every round.
 */
export function buildDraftPicks(params: {
  rosters: Pick<SleeperRoster, 'roster_id'>[];
  tradedPicks: SleeperTradedPick[];
  firstSeason: number;
  seasons?: number;
  rounds: number;
}): DraftPick[] {
  const { rosters, tradedPicks, firstSeason, seasons = 3, rounds } = params;
  const picks = new Map<string, DraftPick>();
  for (let s = 0; s < seasons; s++) {
    const season = String(firstSeason + s);
    for (let round = 1; round <= rounds; round++) {
      for (const roster of rosters) {
        const id = pickId(season, round, roster.roster_id);
        picks.set(id, { id, season, round, originalRosterId: roster.roster_id, ownerRosterId: roster.roster_id });
      }
    }
  }
  for (const traded of tradedPicks) {
    const pick = picks.get(pickId(String(traded.season), traded.round, traded.roster_id));
    if (pick) pick.ownerRosterId = traded.owner_id;
  }
  return [...picks.values()].sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round || a.originalRosterId - b.originalRosterId);
}

/** Base pick values in weekly points over replacement (the trade analyzer's unit) */
const ROUND_VALUES = [6, 3, 1.5, 0.75];
const FUTURE_DISCOUNT = 0.85;

/**
 * Value of a pick. Picks in the next draft are adjusted by where the original
 * team sits in the standings (worse record → earlier pick → more value); later
 * drafts are discounted per year. Pass `standingsRank` only once games have
 * been played – preseason standings say nothing about draft order.
 */
export function pickValue(pick: DraftPick, params: { firstDraftSeason: number; standingsRank?: Map<number, number>; teams: number }): number {
  const base = ROUND_VALUES[pick.round - 1] ?? 0.25;
  const yearsOut = Math.max(0, Number(pick.season) - params.firstDraftSeason);
  let value = base * Math.pow(FUTURE_DISCOUNT, yearsOut);
  const rank = params.standingsRank?.get(pick.originalRosterId);
  if (yearsOut === 0 && rank && params.teams > 1) {
    // rank 1 (best team) picks last: 0.8x … worst team picks first: 1.2x
    value *= 0.8 + (0.4 * (rank - 1)) / (params.teams - 1);
  }
  return Math.round(value * 10) / 10;
}

export function describePick(pick: DraftPick, ownerName: (rosterId: number) => string): string {
  const suffix = pick.round === 1 ? 'st' : pick.round === 2 ? 'nd' : pick.round === 3 ? 'rd' : 'th';
  const via = pick.originalRosterId !== pick.ownerRosterId ? ` (${ownerName(pick.originalRosterId)})` : '';
  return `${pick.season} ${pick.round}${suffix}${via}`;
}

/** First season whose rookie draft hasn't happened yet */
export function nextDraftSeason(league: Pick<SleeperLeague, 'season' | 'status'>): number {
  const season = Number(league.season);
  return league.status === 'pre_draft' ? season : season + 1;
}
