import { describe, expect, it } from 'vitest';
import { getStartingSlots, LineupCandidate, maxWeightAssignment, optimizeLineup } from '@/lib/lineup';

const c = (id: string, position: string, projected: number, extra: Partial<LineupCandidate> = {}): LineupCandidate => ({ id, position, projected, ...extra });

describe('maxWeightAssignment', () => {
  it('finds the best assignment, not the greedy one', () => {
    // Greedy would take 9 for row 0, forcing row 1 to take 1 (total 10). Optimal is 8 + 7 = 15.
    const result = maxWeightAssignment([
      [9, 8],
      [7, 1],
    ]);
    expect(result).toEqual([1, 0]);
  });
});

describe('getStartingSlots', () => {
  it('drops bench, IR and taxi', () => {
    expect(getStartingSlots(['QB', 'RB', 'FLEX', 'BN', 'BN', 'IR', 'TAXI'])).toEqual(['QB', 'RB', 'FLEX']);
  });
});

describe('optimizeLineup', () => {
  const slots = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX'];

  it('fills FLEX and SUPER_FLEX with the best remaining eligible players', () => {
    const candidates = [
      c('qb1', 'QB', 22), c('qb2', 'QB', 18),
      c('rb1', 'RB', 15), c('rb2', 'RB', 12), c('rb3', 'RB', 9),
      c('wr1', 'WR', 16), c('wr2', 'WR', 11), c('wr3', 'WR', 10),
      c('te1', 'TE', 8),
    ];
    const result = optimizeLineup({ slots, currentStarters: [], candidates });
    const starters = new Set(result.optimal.map(a => a.playerId));
    expect(starters.has('qb2')).toBe(true); // SUPER_FLEX gets the second QB
    expect(starters.has('wr3')).toBe(true); // FLEX gets WR3 (10) over RB3 (9)
    expect(starters.has('rb3')).toBe(false);
    expect(result.optimalTotal).toBe(22 + 15 + 12 + 16 + 11 + 8 + 10 + 18);
  });

  it('benches players on bye or ruled out', () => {
    const result = optimizeLineup({
      slots: ['RB', 'FLEX'],
      currentStarters: ['rb1', 'rb2'],
      candidates: [c('rb1', 'RB', 20, { unavailableReason: 'Bye week' }), c('rb2', 'RB', 10), c('wr1', 'WR', 8)],
    });
    expect(result.benched.map(b => b.id)).toEqual(['rb1']);
    expect(result.moves.map(m => m.add.id)).toEqual(['wr1']);
    expect(result.gain).toBe(8);
  });

  it('keeps locked players in place and never moves players whose game started', () => {
    const result = optimizeLineup({
      slots: ['WR', 'FLEX'],
      currentStarters: ['wr1', 'wr2'],
      candidates: [c('wr1', 'WR', 5, { locked: true }), c('wr2', 'WR', 6), c('wr3', 'WR', 30, { locked: true })],
    });
    expect(result.optimal[0].playerId).toBe('wr1');
    expect(result.optimal[1].playerId).toBe('wr2'); // wr3 is locked on the bench
    expect(result.moves).toHaveLength(0);
  });

  it('does not suggest pointless swaps when the lineup is already optimal', () => {
    const result = optimizeLineup({
      slots: ['RB', 'WR', 'FLEX'],
      currentStarters: ['rb1', 'wr1', 'wr2'],
      candidates: [c('rb1', 'RB', 10), c('wr1', 'WR', 10), c('wr2', 'WR', 10), c('rb2', 'RB', 10)],
    });
    expect(result.moves).toHaveLength(0);
    expect(result.gain).toBe(0);
  });

  it('leaves unsupported slots untouched', () => {
    const result = optimizeLineup({
      slots: ['QB', 'K_FLEX'],
      currentStarters: ['qb1', 'k1'],
      candidates: [c('qb1', 'QB', 20)],
    });
    expect(result.optimal[1].locked).toBe(true);
  });

  it('optimizes IDP slots', () => {
    const result = optimizeLineup({
      slots: ['DL', 'LB', 'IDP_FLEX'],
      currentStarters: ['dl1', 'lb1', 'db1'],
      candidates: [c('dl1', 'DL', 6), c('lb1', 'LB', 9), c('db1', 'DB', 4), c('lb2', 'LB', 8)],
    });
    expect(result.moves.map(m => m.add.id)).toEqual(['lb2']);
    expect(result.benched.map(b => b.id)).toEqual(['db1']);
  });
});
