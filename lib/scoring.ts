import {
  ComparisonCategory,
  ComparisonResult,
  FANTASY_POSITIONS,
  Player,
  PlayerWithStats,
  StartSitRecommendation,
  TradeAnalysis,
  TradePickValue,
  TradePlayerValue,
  Winner,
} from '@/types';
import { MatchupInfo, MATCHUP_GRADE_LABELS } from './matchups';
import { blendedValue } from './season';

// ==========================================
// AVAILABILITY
// ==========================================

const UNAVAILABLE_STATUSES = new Set(['Out', 'IR', 'Sus', 'PUP', 'NA', 'DNR', 'COV']);

/** Injury designations that mean the player won't play */
export function isUnavailable(injuryStatus: string | null | undefined): boolean {
  return !!injuryStatus && UNAVAILABLE_STATUSES.has(injuryStatus);
}

/** Expected share of a normal workload given an injury designation */
export function availabilityFactor(injuryStatus: string | null | undefined): number {
  if (!injuryStatus) return 1;
  if (isUnavailable(injuryStatus)) return 0;
  if (injuryStatus === 'Doubtful') return 0.25;
  if (injuryStatus === 'Questionable') return 0.9;
  return 1;
}

export interface PlayerContext {
  matchup?: MatchupInfo;
}

function effectiveProjection(player: PlayerWithStats, ctx?: PlayerContext): number {
  if (ctx?.matchup?.bye) return 0;
  return Math.max(0, player.projectedPoints ?? 0) * availabilityFactor(player.injuryStatus);
}

function pickWinner(v1: number, v2: number, higherIsBetter: boolean, epsilon = 0.05): Winner {
  if (Math.abs(v1 - v2) <= epsilon) return 'tie';
  return (v1 > v2) === higherIsBetter ? 'player1' : 'player2';
}

/** Volatility = standard deviation relative to average (lower is steadier) */
export function volatility(player: PlayerWithStats): number | null {
  if (player.stdDev === null || player.stdDev === undefined) return null;
  const avg = player.avgPoints ?? 0;
  if (avg <= 0) return null;
  return Math.round((player.stdDev / avg) * 1000) / 1000;
}

// ==========================================
// HEAD TO HEAD
// ==========================================

/**
 * Compare two players across projection, season average, recent form,
 * volatility and matchup. Categories without data for both players are left
 * out and the remaining weights are re-normalized.
 */
export function comparePlayersHeadToHead(
  player1: PlayerWithStats,
  player2: PlayerWithStats,
  ctx1?: PlayerContext,
  ctx2?: PlayerContext
): ComparisonResult {
  const breakdown: ComparisonCategory[] = [];

  const proj1 = effectiveProjection(player1, ctx1);
  const proj2 = effectiveProjection(player2, ctx2);
  breakdown.push({ category: 'Projected Points', player1Value: proj1, player2Value: proj2, winner: pickWinner(proj1, proj2, true), higherIsBetter: true, weight: 0.35, format: 'points' });

  // Trust season/recent production in proportion to sample size (full weight at 4+ games)
  const historyFactor = Math.min(1, Math.min(player1.gamesPlayed ?? 0, player2.gamesPlayed ?? 0) / 4);
  if (historyFactor > 0) {
    const avg1 = player1.avgPoints ?? 0;
    const avg2 = player2.avgPoints ?? 0;
    breakdown.push({ category: 'Season Average', player1Value: avg1, player2Value: avg2, winner: pickWinner(avg1, avg2, true), higherIsBetter: true, weight: 0.25 * historyFactor, format: 'points' });

    const recent1 = player1.recentAvgPoints ?? 0;
    const recent2 = player2.recentAvgPoints ?? 0;
    breakdown.push({ category: 'Recent Form (3 games)', player1Value: recent1, player2Value: recent2, winner: pickWinner(recent1, recent2, true), higherIsBetter: true, weight: 0.25 * historyFactor, format: 'points' });
  }

  const vol1 = volatility(player1);
  const vol2 = volatility(player2);
  if (vol1 !== null && vol2 !== null) {
    breakdown.push({ category: 'Volatility', player1Value: vol1, player2Value: vol2, winner: pickWinner(vol1, vol2, false, 0.01), higherIsBetter: false, weight: 0.05 * historyFactor, format: 'percent' });
  }

  const m1 = ctx1?.matchup?.entry?.multiplier;
  const m2 = ctx2?.matchup?.entry?.multiplier;
  if (m1 !== undefined && m2 !== undefined) {
    breakdown.push({ category: 'Matchup', player1Value: m1, player2Value: m2, winner: pickWinner(m1, m2, true, 0.02), higherIsBetter: true, weight: 0.1, format: 'multiplier' });
  }

  const totalWeight = breakdown.reduce((sum, c) => sum + c.weight, 0);
  let score1 = 0;
  let score2 = 0;
  for (const cat of breakdown) {
    const weight = cat.weight / totalWeight;
    const a = Math.max(0, cat.player1Value);
    const b = Math.max(0, cat.player2Value);
    const total = a + b;
    if (total <= 0) {
      score1 += weight * 50;
      score2 += weight * 50;
      continue;
    }
    // Share of the combined value; inverted when lower is better
    const share1 = cat.higherIsBetter ? a / total : b / total;
    score1 += share1 * weight * 100;
    score2 += (1 - share1) * weight * 100;
  }

  const gap = Math.abs(score1 - score2); // 0..100
  const winner: Winner = gap < 1 ? 'tie' : score1 > score2 ? 'player1' : 'player2';
  // 50% when dead even, 100% at a 40-point share gap
  const confidence = winner === 'tie' ? 50 : Math.min(100, Math.round(50 + gap * 1.25));

  return { player1, player2, winner, confidence, breakdown };
}

// ==========================================
// START / SIT
// ==========================================

export function getStartSitRecommendation(
  player1: PlayerWithStats,
  player2: PlayerWithStats,
  ctx1?: PlayerContext,
  ctx2?: PlayerContext
): StartSitRecommendation {
  const p1Out = isUnavailable(player1.injuryStatus) || !!ctx1?.matchup?.bye;
  const p2Out = isUnavailable(player2.injuryStatus) || !!ctx2?.matchup?.bye;
  const outReason = (p: PlayerWithStats, ctx?: PlayerContext) =>
    ctx?.matchup?.bye ? `${p.name} is on a bye this week` : `${p.name} is listed as ${p.injuryStatus}`;

  if (p1Out && p2Out) {
    return {
      start: player1,
      sit: player2,
      confidence: 50,
      tossUp: true,
      reasons: [outReason(player1, ctx1), outReason(player2, ctx2), 'Neither player is expected to play – look for a replacement'],
    };
  }
  if (p1Out !== p2Out) {
    const [start, sit, sitCtx] = p1Out ? [player2, player1, ctx1] : [player1, player2, ctx2];
    return { start, sit, confidence: 95, tossUp: false, reasons: [outReason(sit, sitCtx)] };
  }

  const comparison = comparePlayersHeadToHead(player1, player2, ctx1, ctx2);
  const tossUp = comparison.winner === 'tie';
  // On a tie, lean toward the higher projection (then player 1)
  const p1Starts = tossUp
    ? effectiveProjection(player1, ctx1) >= effectiveProjection(player2, ctx2)
    : comparison.winner === 'player1';
  const [start, sit] = p1Starts ? [player1, player2] : [player2, player1];
  const reasons: string[] = [];

  for (const cat of comparison.breakdown) {
    if (cat.winner === 'tie') continue;
    const winnerName = cat.winner === 'player1' ? player1.name : player2.name;
    const diff = Math.abs(cat.player1Value - cat.player2Value);
    if (cat.category === 'Projected Points' && diff >= 1) {
      reasons.push(`${winnerName} is projected for ${diff.toFixed(1)} more points this week`);
    } else if (cat.category === 'Recent Form (3 games)' && diff >= 3) {
      const games = Math.min(3, player1.gamesPlayed ?? 0, player2.gamesPlayed ?? 0);
      reasons.push(`${winnerName} has been hotter recently (+${diff.toFixed(1)} PPG over the last ${games === 1 ? 'game' : `${games} games`})`);
    } else if (cat.category === 'Season Average' && diff >= 3) {
      reasons.push(`${winnerName} averages ${diff.toFixed(1)} more points per game this season`);
    } else if (cat.category === 'Volatility' && diff >= 0.15) {
      reasons.push(`${winnerName} has been more consistent week to week`);
    }
  }

  for (const [player, ctx] of [[player1, ctx1], [player2, ctx2]] as const) {
    const grade = ctx?.matchup?.grade;
    const entry = ctx?.matchup?.entry;
    if (grade && entry && grade !== 'neutral') {
      reasons.push(
        `${player.name} has a ${MATCHUP_GRADE_LABELS[grade].toLowerCase()} matchup vs ${ctx?.matchup?.opponent} (allows ${entry.allowedPerGame} PPG to ${player.position}s, ${ordinal(entry.rank)} most)`
      );
    }
    if (player.injuryStatus === 'Questionable' || player.injuryStatus === 'Doubtful') {
      reasons.push(`${player.name} is ${player.injuryStatus} – check inactives before kickoff`);
    }
  }

  if (reasons.length === 0) {
    reasons.push(tossUp ? 'These players are virtually identical – go with your gut' : `${start.name} has a slight edge across the board`);
  }

  return { start, sit, confidence: comparison.confidence, tossUp, reasons };
}

// ==========================================
// TRADE ANALYZER
// ==========================================

/** Weighted per-game value used for trades */
export function playerTradeValue(player: PlayerWithStats): number {
  const value = blendedValue({
    projection: player.projectedPoints ?? 0,
    avgPoints: player.avgPoints ?? 0,
    recentAvgPoints: player.recentAvgPoints ?? 0,
    gamesPlayed: player.gamesPlayed ?? 0,
  });
  // Short-term injuries matter less in trades than in a single week
  const injuryFactor = isUnavailable(player.injuryStatus)
    ? player.injuryStatus === 'IR' || player.injuryStatus === 'PUP' ? 0.5 : 0.8
    : player.injuryStatus === 'Doubtful' ? 0.9 : 1;
  return Math.round(value * injuryFactor * 10) / 10;
}

/** Approximate number of startable players per position in a 12-team league */
export const DEFAULT_STARTERS_PER_POSITION: Record<string, number> = {
  QB: 12, RB: 30, WR: 36, TE: 12, K: 12, DEF: 12,
};

/**
 * Replacement level = value of the last "startable" player at each position.
 * Anything below it can be found on waivers, so it adds no trade value.
 */
export function computeReplacementLevels(
  players: PlayerWithStats[],
  startersPerPosition: Record<string, number> = DEFAULT_STARTERS_PER_POSITION,
  valueFn: (player: PlayerWithStats) => number = playerTradeValue
): Record<string, number> {
  const byPosition: Record<string, number[]> = {};
  for (const player of players) {
    (byPosition[player.position] ??= []).push(valueFn(player));
  }
  const levels: Record<string, number> = {};
  for (const position in byPosition) {
    const values = byPosition[position].sort((a, b) => b - a);
    const index = Math.min(values.length - 1, (startersPerPosition[position] ?? 12));
    levels[position] = values.length ? values[Math.max(0, index)] : 0;
  }
  return levels;
}

export interface TradeOptions {
  /** Per-player value (e.g. dynasty age-adjusted). Defaults to playerTradeValue */
  valueFn?: (player: PlayerWithStats) => number;
  givePicks?: TradePickValue[];
  receivePicks?: TradePickValue[];
}

export function analyzeTrade(
  givePlayers: PlayerWithStats[],
  receivePlayers: PlayerWithStats[],
  replacementLevels: Record<string, number>,
  options: TradeOptions = {}
): TradeAnalysis {
  const { valueFn = playerTradeValue, givePicks = [], receivePicks = [] } = options;
  const valueOf = (player: PlayerWithStats): TradePlayerValue => {
    const rawValue = round1(valueFn(player));
    const replacementValue = replacementLevels[player.position] ?? 0;
    return {
      player,
      rawValue,
      replacementValue,
      valueOverReplacement: Math.round(Math.max(0, rawValue - replacementValue) * 10) / 10,
    };
  };

  const give = givePlayers.map(valueOf);
  const receive = receivePlayers.map(valueOf);
  const pickTotal = (picks: TradePickValue[]) => picks.reduce((sum, p) => sum + p.value, 0);
  const giveValue = round1(give.reduce((sum, p) => sum + p.valueOverReplacement, 0) + pickTotal(givePicks));
  const receiveValue = round1(receive.reduce((sum, p) => sum + p.valueOverReplacement, 0) + pickTotal(receivePicks));
  const valueDifference = round1(Math.abs(giveValue - receiveValue));
  const fairThreshold = Math.max(1.5, Math.max(giveValue, receiveValue) * 0.1);

  let winner: TradeAnalysis['winner'];
  let recommendation: string;
  if (valueDifference <= fairThreshold) {
    winner = 'fair';
    recommendation = 'This trade is close to even. Let roster needs and bye weeks decide.';
  } else if (receiveValue > giveValue) {
    winner = 'receive';
    recommendation = `You gain ${valueDifference.toFixed(1)} points per week of value over replacement-level players.`;
  } else {
    winner = 'give';
    recommendation = `You give up ${valueDifference.toFixed(1)} points per week of value over replacement-level players.`;
  }

  let rosterSpotNote: string | undefined;
  const spotDiff = receivePlayers.length - givePlayers.length;
  if (spotDiff > 0) {
    rosterSpotNote = `You receive ${spotDiff} more player${spotDiff > 1 ? 's' : ''} than you send – you'll need to drop ${spotDiff}. Depth below replacement level adds no value.`;
  } else if (spotDiff < 0) {
    rosterSpotNote = `You open ${-spotDiff} roster spot${spotDiff < -1 ? 's' : ''}, which you can fill from waivers.`;
  }

  return { givePlayers: give, receivePlayers: receive, givePicks, receivePicks, giveValue, receiveValue, winner, valueDifference, recommendation, rosterSpotNote };
}

export function isListedPlayer(player: Player): boolean {
  if (player.team === 'FA' || !FANTASY_POSITIONS.includes(player.position)) return false;
  return player.position === 'DEF' || player.status !== 'Inactive';
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
