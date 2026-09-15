import { describe, expect, it } from 'vitest';
import { buildDraftPicks, dynastyAgeMultiplier, pickValue } from '@/lib/dynasty';

describe('dynastyAgeMultiplier', () => {
  it('favors young RBs and discounts aging ones', () => {
    expect(dynastyAgeMultiplier({ position: 'RB', age: 23, experience: 1 })).toBe(1.2);
    expect(dynastyAgeMultiplier({ position: 'RB', age: 30, experience: 8 })).toBe(0.6);
  });
  it('gives rookies a bonus and ignores unknown ages/positions', () => {
    expect(dynastyAgeMultiplier({ position: 'WR', age: 22, experience: 0 })).toBe(1.26);
    expect(dynastyAgeMultiplier({ position: 'K', age: 40, experience: 15 })).toBe(1);
    expect(dynastyAgeMultiplier({ position: 'QB', experience: 3 })).toBe(1);
  });
});

describe('draft picks', () => {
  const rosters = [{ roster_id: 1 }, { roster_id: 2 }];
  const picks = buildDraftPicks({
    rosters,
    tradedPicks: [{ season: '2027', round: 1, roster_id: 2, owner_id: 1, previous_owner_id: 2 }],
    firstSeason: 2027,
    seasons: 2,
    rounds: 2,
  });

  it('creates every pick and applies trades', () => {
    expect(picks).toHaveLength(8);
    expect(picks.filter(p => p.ownerRosterId === 1 && p.season === '2027' && p.round === 1).map(p => p.originalRosterId)).toEqual([1, 2]);
  });

  it('values earlier rounds, nearer years and worse teams higher', () => {
    const standingsRank = new Map([[1, 1], [2, 2]]);
    const [p1, p2] = picks.filter(p => p.season === '2027' && p.round === 1);
    expect(pickValue(p1, { currentSeason: 2026, standingsRank, teams: 2 })).toBe(4.8); // best team picks last
    expect(pickValue(p2, { currentSeason: 2026, standingsRank, teams: 2 })).toBe(7.2);
    const future = picks.find(p => p.season === '2028' && p.round === 1)!;
    expect(pickValue(future, { currentSeason: 2026, teams: 2 })).toBe(5.1);
    const second = picks.find(p => p.season === '2027' && p.round === 2)!;
    expect(pickValue(second, { currentSeason: 2026, teams: 2 })).toBe(3);
  });
});
