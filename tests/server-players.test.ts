import { describe, expect, it } from 'vitest';
import { fantasyPositionsOf } from '@/lib/server/sleeper';

describe('fantasyPositionsOf', () => {
  it('maps NFL defensive positions to IDP positions', () => {
    expect(fantasyPositionsOf({ position: 'DE' as never, fantasy_positions: ['DL'] })).toEqual(['DL']);
    expect(fantasyPositionsOf({ position: 'CB' as never, fantasy_positions: ['DB'] })).toEqual(['DB']);
    expect(fantasyPositionsOf({ position: 'OLB' as never, fantasy_positions: null })).toEqual(['LB']);
  });

  it('keeps multi-position eligibility and offensive positions', () => {
    expect(fantasyPositionsOf({ position: 'LB', fantasy_positions: ['LB', 'DL'] })).toEqual(['LB', 'DL']);
    expect(fantasyPositionsOf({ position: 'WR', fantasy_positions: ['WR'] })).toEqual(['WR']);
  });
});
