import { describe, expect, it } from 'vitest';
import { getBenchIds, playerGameState, projectedFinal, resolvePlayer } from '@/lib/league';
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

  it('keeps unknown or IDP players out of optimized offensive slots', () => {
    const result = optimizeLineup({
      slots: ['QB', 'WR', 'DL', 'LB'],
      currentStarters: ['qb', '0', 'dl1', 'lb1'],
      candidates: [
        { id: 'qb', position: 'QB', projected: 20 },
        { id: 'lb2', position: 'LB', projected: 8 },
        { id: 'mystery', position: resolvePlayer('mystery', new Map()).position, projected: 0 },
      ],
    });
    expect(result.optimal[1].playerId).toBeNull();
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
