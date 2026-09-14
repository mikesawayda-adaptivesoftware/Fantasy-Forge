import { describe, expect, it } from 'vitest';
import { getByeWeek, hasGameStarted, isGameComplete, normalizeSchedule, resolveSeasonContext } from '@/lib/nfl';
import { NflState, SleeperGame } from '@/types';

const baseState: NflState = {
  week: 1,
  season: '2026',
  season_type: 'regular',
  display_week: 1,
  league_season: '2026',
  previous_season: '2025',
  season_start_date: '2026-09-09',
  season_has_scores: true,
};

describe('resolveSeasonContext', () => {
  it('uses the live week during the regular season', () => {
    expect(resolveSeasonContext({ ...baseState, week: 7 })).toEqual({
      season: '2026', week: 7, statsSeason: '2026', statsThroughWeek: 7, inSeason: true,
    });
  });

  it('clamps to week 18 in the postseason (the old date math returned week 1 in January)', () => {
    const ctx = resolveSeasonContext({ ...baseState, season_type: 'post', week: 20 });
    expect(ctx.week).toBe(18);
    expect(ctx.statsThroughWeek).toBe(18);
  });

  it('falls back to last season before the new season starts', () => {
    const ctx = resolveSeasonContext({ ...baseState, season_type: 'pre', week: 0 }, new Date('2026-08-15'));
    expect(ctx).toMatchObject({ season: '2026', week: 1, statsSeason: '2025', statsThroughWeek: 18, inSeason: false });
  });

  it('keeps the finished season in the offseason after it started', () => {
    const ctx = resolveSeasonContext({ ...baseState, season_type: 'off', week: 0 }, new Date('2027-02-20'));
    expect(ctx.statsSeason).toBe('2026');
  });
});

describe('schedule helpers', () => {
  const games: SleeperGame[] = [
    { week: 1, home: 'KC', away: 'BUF', date: '2026-09-10', status: 'complete', game_id: '1' },
    { week: 2, home: 'BUF', away: 'MIA', date: '2026-09-17', status: 'in_game', game_id: '2' },
    { week: 3, home: 'DEN', away: 'KC', date: '2026-09-24', status: 'pre_game', game_id: '3' },
  ];
  const schedule = normalizeSchedule(games);

  it('maps both teams with home/away', () => {
    expect(schedule.KC[1]).toMatchObject({ opponent: 'BUF', home: true });
    expect(schedule.BUF[1]).toMatchObject({ opponent: 'KC', home: false });
  });

  it('finds bye weeks from gaps', () => {
    expect(getByeWeek(schedule, 'KC')).toBe(2);
    expect(getByeWeek(schedule, 'BUF')).toBe(3);
    expect(getByeWeek(schedule, 'XXX')).toBeUndefined();
  });

  it('tracks game status', () => {
    expect(isGameComplete(schedule, 'KC', 1)).toBe(true);
    expect(isGameComplete(schedule, 'BUF', 2)).toBe(false);
    expect(hasGameStarted(schedule, 'MIA', 2)).toBe(true);
    expect(hasGameStarted(schedule, 'KC', 3)).toBe(false);
  });
});
