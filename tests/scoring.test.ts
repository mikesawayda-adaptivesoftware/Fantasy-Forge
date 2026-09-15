import { describe, expect, it } from 'vitest';
import { analyzeTrade, comparePlayersHeadToHead, computeReplacementLevels, getStartSitRecommendation } from '@/lib/scoring';
import { PlayerWithStats } from '@/types';

const p = (id: string, overrides: Partial<PlayerWithStats> = {}): PlayerWithStats => ({
  id,
  name: `Player ${id}`,
  firstName: 'Player',
  lastName: id,
  position: 'WR',
  team: 'KC',
  projectedPoints: 12,
  avgPoints: 12,
  recentAvgPoints: 12,
  gamesPlayed: 5,
  stdDev: 4,
  ...overrides,
});

describe('comparePlayersHeadToHead', () => {
  it('omits volatility when a player has fewer than two games (no free win for rookies)', () => {
    const rookie = p('rookie', { gamesPlayed: 1, stdDev: null });
    const result = comparePlayersHeadToHead(rookie, p('vet'));
    expect(result.breakdown.find(c => c.category === 'Volatility')).toBeUndefined();
  });

  it('does not let a one-game sample dominate the projection', () => {
    const boomWeek = p('boom', { projectedPoints: 12, avgPoints: 35, recentAvgPoints: 35, gamesPlayed: 1, stdDev: null });
    const steady = p('steady', { projectedPoints: 16, avgPoints: 4, recentAvgPoints: 4, gamesPlayed: 1, stdDev: null });
    const result = comparePlayersHeadToHead(boomWeek, steady);
    expect(result.confidence).toBeLessThan(80);
  });

  it('declares a tie for identical players', () => {
    const result = comparePlayersHeadToHead(p('a'), p('b'));
    expect(result.winner).toBe('tie');
    expect(result.confidence).toBe(50);
  });

  it('includes matchup when both players have ratings', () => {
    const result = comparePlayersHeadToHead(
      p('a'),
      p('b'),
      { matchup: { week: 1, bye: false, entry: { allowedPerGame: 40, games: 3, rank: 1, multiplier: 1.3 }, grade: 'great' } },
      { matchup: { week: 1, bye: false, entry: { allowedPerGame: 25, games: 3, rank: 32, multiplier: 0.8 }, grade: 'brutal' } }
    );
    expect(result.winner).toBe('player1');
  });
});

describe('getStartSitRecommendation', () => {
  it('starts the healthy player when the other is out', () => {
    const rec = getStartSitRecommendation(p('a', { injuryStatus: 'Out', projectedPoints: 25 }), p('b'));
    expect(rec.start.id).toBe('b');
    expect(rec.confidence).toBe(95);
  });

  it('flags when both players are unavailable', () => {
    const rec = getStartSitRecommendation(p('a', { injuryStatus: 'IR' }), p('b', { injuryStatus: 'Out' }));
    expect(rec.tossUp).toBe(true);
    expect(rec.reasons.join(' ')).toContain('Neither player');
  });

  it('treats a bye like being out', () => {
    const rec = getStartSitRecommendation(p('a', { projectedPoints: 20 }), p('b'), { matchup: { week: 5, bye: true } });
    expect(rec.start.id).toBe('b');
  });

  it('leans to the higher projection on a toss-up', () => {
    const rec = getStartSitRecommendation(p('a', { projectedPoints: 12 }), p('b', { projectedPoints: 12.02 }));
    expect(rec.tossUp).toBe(true);
    expect(rec.start.id).toBe('b');
  });

  it('discounts doubtful players', () => {
    const rec = getStartSitRecommendation(p('a', { injuryStatus: 'Doubtful', projectedPoints: 15 }), p('b', { projectedPoints: 11 }));
    expect(rec.start.id).toBe('b');
  });
});

describe('analyzeTrade', () => {
  const levels = { WR: 8, RB: 8, QB: 15, TE: 6 };

  it('does not let several replacement-level players outweigh a star', () => {
    const star = p('star', { projectedPoints: 22, avgPoints: 22, recentAvgPoints: 22 });
    const depth = ['d1', 'd2', 'd3'].map(id => p(id, { projectedPoints: 9, avgPoints: 9, recentAvgPoints: 9 }));
    const result = analyzeTrade(depth, [star], levels);
    expect(result.giveValue).toBe(3);
    expect(result.receiveValue).toBe(14);
    expect(result.winner).toBe('receive');
    expect(result.rosterSpotNote).toContain('open 2 roster spots');
  });

  it('calls close deals fair', () => {
    const result = analyzeTrade([p('a', { projectedPoints: 15, avgPoints: 15, recentAvgPoints: 15 })], [p('b', { projectedPoints: 14.5, avgPoints: 14.5, recentAvgPoints: 14.5 })], levels);
    expect(result.winner).toBe('fair');
  });

  it('derives replacement levels from the player pool', () => {
    const pool = Array.from({ length: 20 }, (_, i) => p(`qb${i}`, { position: 'QB', projectedPoints: 30 - i, avgPoints: 30 - i, recentAvgPoints: 30 - i }));
    expect(computeReplacementLevels(pool, { QB: 12 }).QB).toBe(18);
  });
});
