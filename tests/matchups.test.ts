import { describe, expect, it } from 'vitest';
import { computeDefenseVsPosition, getMatchupInfo, gradeFromMultiplier, strengthOfSchedule } from '@/lib/matchups';
import { normalizeSchedule } from '@/lib/nfl';
import { NFL_TEAMS, StatsByPlayer } from '@/types';

function weekOf(allowedToWr: (team: string) => number): StatsByPlayer {
  const stats: StatsByPlayer = {};
  for (const team of NFL_TEAMS) {
    stats[team] = { gp: 1, fan_pts_allow_wr: allowedToWr(team), fan_pts_allow_qb: 18 };
  }
  return stats;
}

describe('computeDefenseVsPosition', () => {
  const current = [1, 2, 3, 4].map(week => ({ week, stats: weekOf(team => (team === 'KC' ? 20 : team === 'MIA' ? 50 : 35)) }));
  const dvp = computeDefenseVsPosition(current, [], 0);

  it('ranks the most generous defense first', () => {
    expect(dvp.MIA.WR?.rank).toBe(1);
    expect(dvp.KC.WR?.rank).toBe(32);
    expect(dvp.MIA.WR?.allowedPerGame).toBe(50);
  });

  it('expresses matchups relative to league average', () => {
    expect(dvp.MIA.WR!.multiplier).toBeGreaterThan(1.3);
    expect(dvp.KC.WR!.multiplier).toBeLessThan(0.7);
    expect(dvp.BUF.QB!.multiplier).toBe(1);
  });

  it('shrinks thin early-season samples toward last season', () => {
    const previous = Array.from({ length: 17 }, (_, i) => ({ week: i + 1, stats: weekOf(() => 35) }));
    const oneWeek = [{ week: 1, stats: weekOf(team => (team === 'MIA' ? 80 : 35)) }];
    const blended = computeDefenseVsPosition(oneWeek, previous, 3);
    // (80 + 35 * 3) / 4 = 46.25 instead of a raw 80
    expect(blended.MIA.WR?.allowedPerGame).toBeCloseTo(46.3, 1);
    expect(blended.MIA.WR?.games).toBe(1);
  });

  it('ignores teams that have not played', () => {
    const stats = weekOf(() => 35);
    stats.KC = { gp: 0 };
    const result = computeDefenseVsPosition([{ week: 1, stats }], [], 0);
    expect(result.KC.WR?.games).toBe(0);
  });
});

describe('matchup info', () => {
  const schedule = normalizeSchedule([
    { week: 1, home: 'KC', away: 'MIA', date: '', status: 'pre_game', game_id: '1' },
    { week: 3, home: 'KC', away: 'BUF', date: '', status: 'pre_game', game_id: '2' },
  ]);
  const dvp = computeDefenseVsPosition([{ week: 1, stats: weekOf(team => (team === 'MIA' ? 60 : 30)) }], [], 0);

  it('looks up the opponent defense for the player position', () => {
    const info = getMatchupInfo({ position: 'WR', team: 'KC', week: 1, schedule, dvp });
    expect(info.opponent).toBe('MIA');
    expect(info.grade).toBe('great');
  });

  it('flags byes', () => {
    expect(getMatchupInfo({ position: 'WR', team: 'KC', week: 2, schedule, dvp }).bye).toBe(true);
  });

  it('averages strength of schedule ignoring byes', () => {
    const sos = strengthOfSchedule([1, 2, 3].map(week => getMatchupInfo({ position: 'WR', team: 'KC', week, schedule, dvp })));
    expect(sos).not.toBeNull();
    expect(sos!.multiplier).toBeGreaterThan(1);
  });

  it('grades multipliers', () => {
    expect(gradeFromMultiplier(1.2)).toBe('great');
    expect(gradeFromMultiplier(1.0)).toBe('neutral');
    expect(gradeFromMultiplier(0.8)).toBe('brutal');
  });
});
