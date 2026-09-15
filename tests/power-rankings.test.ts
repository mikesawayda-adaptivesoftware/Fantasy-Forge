import { describe, expect, it } from 'vitest';
import { compareStandings, computePowerRankings, getScoredWeeks, toWeeklyScores } from '@/lib/power-rankings';
import { SleeperLeague, SleeperRoster } from '@/types';

const roster = (id: number, wins: number, losses: number, ties: number, fpts: number, fptsDecimal = 0, ppts?: number): SleeperRoster => ({
  roster_id: id,
  owner_id: `u${id}`,
  league_id: 'L',
  players: [],
  starters: [],
  reserve: null,
  taxi: null,
  settings: { wins, losses, ties, fpts, fpts_decimal: fptsDecimal, ppts, ppts_decimal: 0 },
});

describe('compareStandings', () => {
  it('counts ties as half a win and breaks ties with decimal points', () => {
    const a = roster(1, 2, 1, 1, 400, 10); // 62.5%
    const b = roster(2, 3, 1, 0, 350); // 75%
    const c = roster(3, 2, 1, 1, 400, 90); // 62.5%, more points than a
    expect([a, b, c].sort(compareStandings).map(r => r.roster_id)).toEqual([2, 3, 1]);
  });
});

describe('computePowerRankings', () => {
  const rosters = [roster(1, 2, 0, 0, 240, 0, 260), roster(2, 0, 2, 0, 230, 0, 250), roster(3, 1, 1, 0, 150), roster(4, 1, 1, 0, 160)];
  const weeks = [
    { week: 1, scores: { 1: 110, 2: 120, 3: 70, 4: 90 } },
    { week: 2, scores: { 1: 130, 2: 110, 3: 80, 4: 70 } },
  ];
  const rows = computePowerRankings(rosters, weeks);
  const byId = new Map(rows.map(r => [r.rosterId, r]));

  it('computes all-play records', () => {
    expect(byId.get(1)).toMatchObject({ allPlayWins: 5, allPlayLosses: 1 });
    expect(byId.get(2)).toMatchObject({ allPlayWins: 5, allPlayLosses: 1 });
    expect(byId.get(3)).toMatchObject({ allPlayWins: 1, allPlayLosses: 5 });
  });

  it('measures luck as actual wins minus all-play expectation', () => {
    expect(byId.get(2)!.luckWins).toBeCloseTo(-1.7, 1); // 0 wins vs 83% all-play over 2 games
    expect(byId.get(3)!.luckWins).toBeCloseTo(0.7, 1);
  });

  it('ranks unlucky high scorers above lucky low scorers', () => {
    expect(byId.get(2)!.rank).toBeLessThan(byId.get(3)!.rank);
    expect(rows[0].rosterId).toBe(1);
  });

  it('reports lineup efficiency when max points are known', () => {
    expect(byId.get(1)!.efficiency).toBeCloseTo(240 / 260, 3);
    expect(byId.get(3)!.efficiency).toBeNull();
  });
});

describe('getScoredWeeks / toWeeklyScores', () => {
  const league = { settings: { start_week: 1, playoff_week_start: 15, last_scored_leg: 4 } } as unknown as SleeperLeague;

  it('uses the last scored week and stops before the playoffs', () => {
    expect(getScoredWeeks(league, 5)).toEqual([1, 2, 3, 4]);
    const late = { settings: { start_week: 1, playoff_week_start: 15, last_scored_leg: 16 } } as unknown as SleeperLeague;
    expect(getScoredWeeks(late, 17)).toHaveLength(14);
  });

  it('skips rosters without a matchup (median/bye weeks)', () => {
    const scores = toWeeklyScores(1, [
      { roster_id: 1, matchup_id: 1, points: 100, players: [], starters: [] },
      { roster_id: 2, matchup_id: null, points: 0, players: [], starters: [] },
    ]);
    expect(scores.scores).toEqual({ 1: 100 });
  });
});
