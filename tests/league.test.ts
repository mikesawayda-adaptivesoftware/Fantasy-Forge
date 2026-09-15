import { describe, expect, it } from 'vitest';
import { getBenchIds, leagueHasIdp, playerGameState, projectedFinal, resolvePlayer, startersPerPositionForLeague } from '@/lib/league';
import { canFillSlot, optimizeLineup } from '@/lib/lineup';
import { normalizeSchedule } from '@/lib/nfl';
import { SleeperRoster } from '@/types';

const schedule = normalizeSchedule([
  { week: 2, home: 'KC', away: 'BUF', date: '2026-09-20', status: 'pre_game', game_id: '1' },
  { week: 2, home: 'MIA', away: 'NE', date: '2026-09-20', status: 'complete', game_id: '2' },
  { week: 3, home: 'KC', away: 'DEN', date: '2026-09-27', status: 'pre_game', game_id: '3' },
]);

describe('playerGameState', () => {
  const sunday = new Date('2026-09-20T15:00:00Z');

  it('uses the schedule status when it is current', () => {
    expect(playerGameState(schedule, 'MIA', 2, 0, sunday)).toBe('complete');
    expect(playerGameState(schedule, 'KC', 2, 0, sunday)).toBe('pre_game');
  });

  it('treats recorded points as started even if the schedule still says pre_game', () => {
    expect(playerGameState(schedule, 'KC', 2, 4.5, sunday)).toBe('in_game');
  });

  it('treats a past game date as started', () => {
    expect(playerGameState(schedule, 'KC', 2, 0, new Date('2026-09-22T12:00:00Z'))).toBe('in_game');
  });

  it('detects byes', () => {
    expect(playerGameState(schedule, 'MIA', 3, 0, sunday)).toBe('bye');
  });
});

describe('resolvePlayer', () => {
  it('gives unknown IDs a position no lineup slot accepts', () => {
    const unknown = resolvePlayer('99999', new Map());
    expect(unknown.name).toBe('Unknown player');
    for (const slot of ['QB', 'WR', 'FLEX', 'SUPER_FLEX']) expect(canFillSlot(slot, unknown.position)).toBe(false);
  });

  it('keeps unknown players out of every slot', () => {
    const result = optimizeLineup({
      slots: ['QB', 'WR', 'DL'],
      currentStarters: ['qb', '0', '0'],
      candidates: [
        { id: 'qb', position: 'QB', projected: 20 },
        { id: 'mystery', position: resolvePlayer('mystery', new Map()).position, projected: 10 },
      ],
    });
    expect(result.optimal[1].playerId).toBeNull();
    expect(result.optimal[2].playerId).toBeNull();
    expect(result.moves).toHaveLength(0);
  });

  it('recognizes team defenses without a player record', () => {
    expect(resolvePlayer('KC', new Map()).position).toBe('DEF');
  });
});

describe('projectedFinal / getBenchIds', () => {
  it('mixes final, live and projected points', () => {
    const playersById = new Map([
      ['a', { id: 'a', name: 'A', firstName: '', lastName: '', position: 'WR' as const, team: 'MIA' }],
      ['b', { id: 'b', name: 'B', firstName: '', lastName: '', position: 'WR' as const, team: 'KC' }],
    ]);
    const total = projectedFinal({
      starterIds: ['a', 'b', '0'],
      playersById,
      schedule,
      week: 2,
      actualPoints: { a: 21 },
      projected: new Map([['a', 10], ['b', 12]]),
    });
    expect(total).toBe(33);
  });

  it('excludes starters, IR and taxi from the bench', () => {
    const roster = { players: ['a', 'b', 'c', 'd'], reserve: ['c'], taxi: ['d'] } as unknown as SleeperRoster;
    expect(getBenchIds(roster, ['a'])).toEqual(['b']);
  });
});

describe('playerGameState with kickoff times', () => {
  const live = normalizeSchedule([{ week: 2, home: 'KC', away: 'BUF', date: '2026-09-20', status: 'pre_game', game_id: '1' }]);
  live.KC[2] = { ...live.KC[2], kickoff: '2026-09-21T00:20:00+00:00' };

  it('stays unlocked before kickoff even after the UTC date rolls over', () => {
    expect(playerGameState(live, 'KC', 2, 0, new Date('2026-09-21T00:10:00Z'))).toBe('pre_game');
  });

  it('locks at kickoff', () => {
    expect(playerGameState(live, 'KC', 2, 0, new Date('2026-09-21T00:20:00Z'))).toBe('in_game');
  });
});

describe('league shape helpers', () => {
  it('detects IDP leagues', () => {
    expect(leagueHasIdp(['QB', 'RB', 'IDP_FLEX', 'BN'])).toBe(true);
    expect(leagueHasIdp(['QB', 'RB', 'FLEX', 'BN'])).toBe(false);
  });

  it('counts league-wide starters per position including flex shares', () => {
    const starters = startersPerPositionForLeague(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'K', 'DEF', 'BN', 'IR'], 10);
    expect(starters.QB).toBe(18); // 10 QB + 8 superflex
    expect(starters.RB).toBe(26); // 20 + 4.5 flex + 1 superflex
    expect(starters.TE).toBe(11);
    expect(starters.K).toBe(10);
  });
});
