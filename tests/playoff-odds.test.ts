import { describe, expect, it } from 'vitest';
import { byeCount, simulatePlayoffOdds, toScheduledWeek } from '@/lib/playoff-odds';
import { SleeperRoster } from '@/types';

const roster = (id: number, wins: number, losses: number, fpts: number): SleeperRoster => ({
  roster_id: id, owner_id: `u${id}`, league_id: 'L', players: [], starters: [], reserve: null, taxi: null,
  settings: { wins, losses, ties: 0, fpts, fpts_decimal: 0 },
});

const scores = (values: Record<number, number>) => ({ week: 1, scores: values });

describe('simulatePlayoffOdds', () => {
  const rosters = [roster(1, 9, 1, 1300), roster(2, 7, 3, 1200), roster(3, 5, 5, 1100), roster(4, 1, 9, 900)];
  const completed = Array.from({ length: 10 }, (_, i) => ({ ...scores({ 1: 130, 2: 120, 3: 110, 4: 90 }), week: i + 1 }));

  it('allocates exactly playoffTeams spots per simulation', () => {
    const rows = simulatePlayoffOdds({
      rosters,
      completed,
      remaining: [{ week: 11, pairs: [[1, 4], [2, 3]] }, { week: 12, pairs: [[1, 3], [2, 4]] }],
      playoffTeams: 2,
      simulations: 2000,
    });
    const total = rows.reduce((sum, r) => sum + r.playoffPct, 0);
    expect(total).toBeCloseTo(200, 0);
    expect(rows.find(r => r.rosterId === 1)!.playoffPct).toBeGreaterThan(rows.find(r => r.rosterId === 3)!.playoffPct);
  });

  it('marks clinched and eliminated teams with no games left', () => {
    const rows = simulatePlayoffOdds({ rosters, completed, remaining: [], playoffTeams: 2, simulations: 200 });
    expect(rows.find(r => r.rosterId === 1)).toMatchObject({ clinched: true, playoffPct: 100, averageSeed: 1 });
    expect(rows.find(r => r.rosterId === 4)).toMatchObject({ eliminated: true, playoffPct: 0 });
  });

  it('is deterministic for a given seed and handles unpublished schedules', () => {
    const args = { rosters, completed, remaining: [{ week: 11, pairs: [] as [number, number][] }], playoffTeams: 2, simulations: 500, seed: 7 };
    expect(simulatePlayoffOdds(args)).toEqual(simulatePlayoffOdds(args));
  });
});

describe('helpers', () => {
  it('computes byes from bracket size', () => {
    expect(byeCount(6)).toBe(2);
    expect(byeCount(4)).toBe(0);
    expect(byeCount(7)).toBe(1);
  });

  it('builds pairs from matchups', () => {
    const week = toScheduledWeek(5, [
      { roster_id: 1, matchup_id: 1, points: 0, players: [], starters: [] },
      { roster_id: 2, matchup_id: 1, points: 0, players: [], starters: [] },
      { roster_id: 3, matchup_id: null, points: 0, players: [], starters: [] },
    ]);
    expect(week.pairs).toEqual([[1, 2]]);
  });
});
