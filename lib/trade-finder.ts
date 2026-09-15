import { lineupTotal, WaiverPlayerInput } from './waivers';

export interface TradeRoster {
  rosterId: number;
  players: WaiverPlayerInput[];
}

export interface TradeIdea {
  partnerRosterId: number;
  giveIds: string[];
  receiveIds: string[];
  /** Change in your optimal lineup value (points/week) */
  yourGain: number;
  /** Change in the partner's optimal lineup value */
  partnerGain: number;
}

export interface TradeFinderOptions {
  /** How many of each team's most valuable players to consider */
  candidatesPerTeam?: number;
  /** Also search 2-for-1 and 1-for-2 packages */
  includePackages?: boolean;
  /** Minimum gain for you to suggest a trade */
  minGain?: number;
  /** Largest loss the partner may take (they need a reason to accept) */
  maxPartnerLoss?: number;
  ideasPerTeam?: number;
}

function withSwap(roster: WaiverPlayerInput[], outIds: string[], incoming: WaiverPlayerInput[]): WaiverPlayerInput[] {
  const out = new Set(outIds);
  return roster.filter(p => !out.has(p.id)).concat(incoming);
}

function pairs<T>(items: T[]): [T, T][] {
  const result: [T, T][] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) result.push([items[i], items[j]]);
  return result;
}

export interface TradeCandidate {
  give: WaiverPlayerInput[];
  receive: WaiverPlayerInput[];
}

/** Every 1-for-1 (and optionally 2-for-1 / 1-for-2) package worth evaluating */
export function candidateTrades(you: TradeRoster, partner: TradeRoster, options: TradeFinderOptions = {}): TradeCandidate[] {
  const { candidatesPerTeam = 10, includePackages = true } = options;
  const top = (players: WaiverPlayerInput[], n: number) => [...players].sort((a, b) => b.value - a.value).slice(0, n);
  const yours = top(you.players, candidatesPerTeam);
  const theirs = top(partner.players, candidatesPerTeam);
  const candidates: TradeCandidate[] = [];
  for (const give of yours) for (const receive of theirs) candidates.push({ give: [give], receive: [receive] });
  if (includePackages) {
    const small = Math.min(6, candidatesPerTeam);
    for (const [a, b] of pairs(top(you.players, small))) for (const receive of top(partner.players, small)) candidates.push({ give: [a, b], receive: [receive] });
    for (const give of top(you.players, small)) for (const [a, b] of pairs(top(partner.players, small))) candidates.push({ give: [give], receive: [a, b] });
  }
  return candidates;
}

export interface TradeEvaluator {
  evaluate: (candidate: TradeCandidate) => TradeIdea | null;
}

/**
 * Re-solves both teams' best lineups for a candidate trade. Base lineups are
 * computed once per partner.
 */
export function createTradeEvaluator(slots: string[], you: TradeRoster, partner: TradeRoster, options: TradeFinderOptions = {}): TradeEvaluator {
  const { minGain = 0.5, maxPartnerLoss = 0.5 } = options;
  const baseYou = lineupTotal(slots, you.players, 'value');
  const basePartner = lineupTotal(slots, partner.players, 'value');
  return {
    evaluate: ({ give, receive }) => {
      const yourGain = lineupTotal(slots, withSwap(you.players, give.map(p => p.id), receive), 'value') - baseYou;
      if (yourGain < minGain) return null;
      const partnerGain = lineupTotal(slots, withSwap(partner.players, receive.map(p => p.id), give), 'value') - basePartner;
      if (partnerGain < -maxPartnerLoss) return null;
      return {
        partnerRosterId: partner.rosterId,
        giveIds: give.map(p => p.id),
        receiveIds: receive.map(p => p.id),
        yourGain: Math.round(yourGain * 10) / 10,
        partnerGain: Math.round(partnerGain * 10) / 10,
      };
    },
  };
}

/**
 * Find trades with one partner that improve your optimal lineup without
 * making theirs meaningfully worse. Each candidate is evaluated by re-solving
 * both teams' best lineups for the league's real slots, so positional need and
 * surplus are accounted for automatically.
 */
export function findTradesWithPartner(
  slots: string[],
  you: TradeRoster,
  partner: TradeRoster,
  options: TradeFinderOptions = {}
): TradeIdea[] {
  const { ideasPerTeam = 3 } = options;
  const evaluator = createTradeEvaluator(slots, you, partner, options);
  const ideas = candidateTrades(you, partner, options)
    .map(evaluator.evaluate)
    .filter((idea): idea is TradeIdea => idea !== null);
  return topIdeas(ideas, ideasPerTeam);
}

export function topIdeas(ideas: TradeIdea[], count: number): TradeIdea[] {
  return [...ideas].sort((a, b) => scoreIdea(b) - scoreIdea(a)).slice(0, count);
}

/** Prefer big gains for you, but reward trades the partner also benefits from */
export function scoreIdea(idea: TradeIdea): number {
  return idea.yourGain + Math.min(idea.partnerGain, 2) * 0.5;
}
