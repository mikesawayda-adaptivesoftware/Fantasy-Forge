import { describe, expect, it } from 'vitest';
import { applyLiveScores } from '@/lib/server/sleeper';
import { normalizeSchedule } from '@/lib/nfl';

describe('applyLiveScores', () => {
  it('overlays kickoff, live status, scores and clock for both teams', () => {
    const schedule = normalizeSchedule([{ week: 2, home: 'KC', away: 'BUF', date: '2026-09-20', status: 'pre_game', game_id: '1' }]);
    const live = applyLiveScores(schedule, [
      {
        week: 2,
        games: [
          {
            status: 'in_game',
            metadata: { home_team: 'KC', away_team: 'BUF', date_time: '2026-09-20T20:25:00+00:00', home_score: 17, away_score: 10, quarter: '3', time_remaining: '08:21', is_in_progress: true },
          },
        ],
      },
    ]);
    expect(live.KC[2]).toMatchObject({ status: 'in_game', kickoff: '2026-09-20T20:25:00+00:00', teamScore: 17, opponentScore: 10, clock: 'Q3 08:21' });
    expect(live.BUF[2]).toMatchObject({ teamScore: 10, opponentScore: 17 });
    // original schedule is not mutated
    expect(schedule.KC[2].status).toBe('pre_game');
  });
});
