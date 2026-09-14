import { describe, expect, it } from 'vitest';
import { blendedValue, findWaiverSuggestions, WaiverPlayerInput } from '@/lib/waivers';

const w = (id: string, position: string, value: number, weekProjection = value): WaiverPlayerInput => ({ id, position, value, weekProjection });

describe('findWaiverSuggestions', () => {
  const slots = ['QB', 'RB', 'WR', 'FLEX'];
  const roster = [w('qb', 'QB', 18), w('rb1', 'RB', 14), w('wr1', 'WR', 13), w('wr2', 'WR', 9), w('rb2', 'RB', 4), w('te', 'TE', 3)];
  const starters = new Set(['qb', 'rb1', 'wr1', 'wr2']);

  it('suggests a free agent who would crack the optimal lineup', () => {
    const suggestions = findWaiverSuggestions({ slots, roster, protectedIds: starters, freeAgents: [w('fa-wr', 'WR', 12), w('fa-k', 'K', 9)] });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ addId: 'fa-wr', type: 'upgrade', valueGain: 3 });
    expect(starters.has(suggestions[0].dropId)).toBe(false);
  });

  it('suggests this-week fill-ins for byes', () => {
    const byeRoster = roster.map(p => (p.id === 'qb' ? { ...p, weekProjection: 0 } : p));
    const suggestions = findWaiverSuggestions({ slots, roster: byeRoster, protectedIds: starters, freeAgents: [w('fa-qb', 'QB', 14)] });
    expect(suggestions[0]).toMatchObject({ addId: 'fa-qb', type: 'this-week', weekGain: 14 });
  });

  it('returns nothing when no one helps', () => {
    expect(findWaiverSuggestions({ slots, roster, protectedIds: starters, freeAgents: [w('fa', 'WR', 5)] })).toEqual([]);
  });
});

describe('blendedValue', () => {
  it('relies on projection without history and blends in production with games', () => {
    expect(blendedValue({ projection: 10, avgPoints: 0, recentAvgPoints: 0, gamesPlayed: 0 })).toBe(10);
    expect(blendedValue({ projection: 10, avgPoints: 20, recentAvgPoints: 20, gamesPlayed: 4 })).toBe(15);
  });
});
