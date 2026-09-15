'use client';

import { useMemo } from 'react';
import { FantasyData } from '@/lib/hooks/useFantasyData';
import { LeagueData } from '@/lib/hooks/useLeagueData';
import { getStartingSlots, isSlotSupported, slotLabel } from '@/lib/lineup';
import { analyzeRosterLineup, resolvePlayer } from '@/lib/league';
import { formatPoints, formatSigned } from '@/lib/utils';
import RosterPlayerRow from './RosterPlayerRow';

export default function LineupView({ league, data }: { league: LeagueData; data: FantasyData }) {
  const { userRoster, userMatchup, week } = league;
  const slots = useMemo(() => getStartingSlots(league.league?.roster_positions), [league.league]);

  const result = useMemo(() => {
    if (!userRoster || !week || !league.league) return null;
    return analyzeRosterLineup({
      rosterPositions: league.league.roster_positions,
      roster: userRoster,
      matchup: userMatchup,
      playersById: data.playersById,
      schedule: data.schedule,
      week,
      projectionFor: id => data.projected.get(id) ?? 0,
    });
  }, [userRoster, userMatchup, week, league.league, data.playersById, data.schedule, data.projected]);

  if (!userRoster || !result || !week) {
    return (
      <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
        <span className="text-4xl mb-3 block">🎯</span>
        <p className="text-text-secondary">Connect the Sleeper account that owns a team in this league to optimize your lineup.</p>
      </div>
    );
  }

  const { optimization, candidates } = result;
  const byId = new Map(candidates.map(c => [c.id, c]));
  const currentIds = new Set(optimization.current.map(a => a.playerId).filter(Boolean));
  const optimalIds = new Set(optimization.optimal.map(a => a.playerId).filter(Boolean));
  const warnings = optimization.optimal
    .map(a => (a.playerId ? resolvePlayer(a.playerId, data.playersById) : null))
    .filter(p => p && (p.injuryStatus === 'Questionable' || p.injuryStatus === 'Doubtful'));
  const unsupported = slots.filter(slot => !isSlotSupported(slot));
  const lockedCount = optimization.current.filter(a => a.locked && a.playerId).length;

  return (
    <div className="space-y-6">
      <div className={`rounded-xl p-5 border ${optimization.moves.length ? 'bg-gold/10 border-gold/30' : 'bg-turf/10 border-turf/30'}`}>
        {optimization.moves.length ? (
          <>
            <h3 className="font-semibold text-gold text-lg flex items-center gap-2">
              <span aria-hidden>💡</span> Your lineup can gain {formatSigned(optimization.gain)} projected points
            </h3>
            <p className="text-text-secondary text-sm mt-1">
              Current {formatPoints(optimization.currentTotal)} → optimal {formatPoints(optimization.optimalTotal)} · {data.scoringLabel}
            </p>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-turf text-lg flex items-center gap-2">
              <span aria-hidden>✅</span> Your lineup is already optimal
            </h3>
            <p className="text-text-secondary text-sm mt-1">
              {formatPoints(optimization.currentTotal)} projected points across {slots.length} starting slots · {data.scoringLabel}
            </p>
          </>
        )}
        {lockedCount > 0 && (
          <p className="text-text-muted text-xs mt-2">{lockedCount} starter{lockedCount > 1 ? 's are' : ' is'} locked because their game has started.</p>
        )}
        {unsupported.length > 0 && (
          <p className="text-text-muted text-xs mt-1">Slots not optimized (kept as-is): {unsupported.map(slotLabel).join(', ')}</p>
        )}
      </div>

      {optimization.moves.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-turf mb-3">START</h4>
            <div className="space-y-2">
              {optimization.moves.map(move => {
                const player = resolvePlayer(move.add.id, data.playersById);
                return (
                  <RosterPlayerRow
                    key={move.add.id}
                    player={player}
                    slot={slotLabel(move.slot)}
                    matchup={data.getMatchup(player, week)}
                    highlight="add"
                    right={<div className="stat-number text-sm text-turf">{formatPoints(move.add.projected)}</div>}
                  />
                );
              })}
            </div>
          </div>
          <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-red mb-3">BENCH</h4>
            <div className="space-y-2">
              {optimization.benched.map(candidate => {
                const player = resolvePlayer(candidate.id, data.playersById);
                return (
                  <RosterPlayerRow
                    key={candidate.id}
                    player={player}
                    matchup={data.getMatchup(player, week)}
                    highlight="remove"
                    right={
                      <>
                        <div className="stat-number text-sm text-red">{formatPoints(candidate.unavailableReason ? 0 : candidate.projected)}</div>
                        {candidate.unavailableReason && <div className="text-xs text-text-muted">{candidate.unavailableReason}</div>}
                      </>
                    }
                  />
                );
              })}
              {optimization.benched.length === 0 && <p className="text-sm text-text-muted">Fills empty slots – nobody needs to sit.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
        <h4 className="font-semibold text-white mb-3">Optimal Lineup</h4>
        <div className="space-y-2">
          {optimization.optimal.map(assignment => {
            const candidate = assignment.playerId ? byId.get(assignment.playerId) : undefined;
            const player = assignment.playerId ? resolvePlayer(assignment.playerId, data.playersById) : null;
            return (
              <RosterPlayerRow
                key={assignment.slotIndex}
                player={player}
                slot={slotLabel(assignment.slot)}
                matchup={player ? data.getMatchup(player, week) : undefined}
                highlight={assignment.playerId && !currentIds.has(assignment.playerId) ? 'add' : null}
                right={
                  player && (
                    <>
                      <div className="stat-number text-sm text-gold">{formatPoints(assignment.projected)}</div>
                      <div className="text-xs text-text-muted">
                        {assignment.locked ? '🔒 Locked' : candidate?.unavailableReason ?? 'Projected'}
                      </div>
                    </>
                  )
                }
              />
            );
          })}
        </div>
        {warnings.length > 0 && (
          <p className="text-xs text-gold mt-3">
            ⚠️ Check game-time decisions: {warnings.map(p => `${p?.name} (${p?.injuryStatus})`).join(', ')}
          </p>
        )}
        {optimalIds.size < slots.length && (
          <p className="text-xs text-red mt-2">You don&apos;t have enough eligible players to fill every slot – check the waiver wire.</p>
        )}
      </div>
    </div>
  );
}
