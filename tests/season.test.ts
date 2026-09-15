import { describe, expect, it } from 'vitest';
import { buildPlayerSeasons, hasPlayed, standardDeviation, tierFromRank } from '@/lib/season';
import { SCORING_PRESETS } from '@/lib/points';
import { normalizeSchedule } from '@/lib/nfl';
import { Player } from '@/types';

const player: Player = { id: '1', name: 'Test WR', firstName: 'Test', lastName: 'WR', position: 'WR', team: 'KC' };
const playersById = new Map([[player.id, player]]);

describe('hasPlayed', () => {
  it('trusts the gp flag, including zero-point games', () => {
    expect(hasPlayed({ gp: 1 })).toBe(true);
    expect(hasPlayed({ gp: 0, rec: 1 })).toBe(false);
  });
  it('falls back to activity when gp is missing', () => {
    expect(hasPlayed({ rec_tgt: 2 })).toBe(true);
    expect(hasPlayed({})).toBe(false);
  });
});

describe('buildPlayerSeasons', () => {
  const schedule = normalizeSchedule([
    { week: 1, home: 'KC', away: 'BUF', date: '', status: 'complete', game_id: '1' },
    { week: 2, home: 'KC', away: 'DEN', date: '', status: 'complete', game_id: '2' },
    { week: 3, home: 'LV', away: 'KC', date: '', status: 'complete', game_id: '3' },
    { week: 4, home: 'KC', away: 'LAC', date: '', status: 'complete', game_id: '4' },
    { week: 5, home: 'KC', away: 'NYJ', date: '', status: 'in_game', game_id: '5' },
  ]);

  const weeks = [
    { week: 1, stats: { '1': { gp: 1, rec: 5, rec_yd: 50 } } }, // 10
    { week: 2, stats: { '1': { gp: 1 } } }, // 0 – counts as a game
    { week: 3, stats: { '1': { gp: 1, rec: 10, rec_yd: 100, rec_td: 1 } } }, // 26
    { week: 4, stats: { '1': { gp: 1, rec: 2, rec_yd: 20 } } }, // 4
    { week: 5, stats: { '1': { gp: 1, rec: 8, rec_yd: 90 } } }, // in progress – skipped
  ];

  const seasons = buildPlayerSeasons({ weeks, scoring: SCORING_PRESETS.ppr, playersById, schedule });
  const season = seasons.get('1')!;

  it('includes zero-point games and skips in-progress games', () => {
    expect(season.gamesPlayed).toBe(4);
    expect(season.gameLog.map(g => g.week)).toEqual([1, 2, 3, 4]);
  });

  it('computes averages and recent form over games played', () => {
    expect(season.totalPoints).toBe(40);
    expect(season.avgPoints).toBe(10);
    expect(season.recentAvgPoints).toBe(10); // (0 + 26 + 4) / 3
  });

  it('attaches opponents from the real schedule', () => {
    expect(season.gameLog[2]).toMatchObject({ opponent: 'LV', home: false });
  });
});

describe('standardDeviation', () => {
  it('returns null with fewer than two games', () => {
    expect(standardDeviation([12])).toBeNull();
    expect(standardDeviation([10, 20])).toBe(5);
  });
});

describe('tierFromRank', () => {
  it('buckets positional ranks', () => {
    expect(tierFromRank(3)).toBe(1);
    expect(tierFromRank(12)).toBe(2);
    expect(tierFromRank(40)).toBe(5);
    expect(tierFromRank(undefined)).toBe(5);
  });
});

describe('buildPlayerSeasons with weekly teams (traded players)', () => {
  it('uses the team and opponent from that week instead of the current team', () => {
    const traded: Player = { id: '9', name: 'Traded', firstName: 'T', lastName: 'R', position: 'RB', team: 'NYJ' };
    const seasons = buildPlayerSeasons({
      weeks: [
        { week: 1, stats: { '9': { gp: 1, rush_yd: 50 } }, teams: { '9': ['DAL', 'PHI'] } },
        { week: 2, stats: { '9': { gp: 1, rush_yd: 70 } }, teams: { '9': ['NYJ', 'NE'] } },
      ],
      scoring: SCORING_PRESETS.ppr,
      playersById: new Map([['9', traded]]),
      schedule: null,
    });
    expect(seasons.get('9')!.gameLog.map(g => [g.team, g.opponent])).toEqual([['DAL', 'PHI'], ['NYJ', 'NE']]);
  });
});
