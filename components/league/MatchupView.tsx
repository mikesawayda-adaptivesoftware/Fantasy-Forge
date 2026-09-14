'use client';

import Image from 'next/image';
import { SleeperMatchup, SleeperRoster } from '@/types';
import { FantasyData } from '@/lib/hooks/useFantasyData';
import { LeagueData } from '@/lib/hooks/useLeagueData';
import { getStartingSlots, slotLabel } from '@/lib/lineup';
import { getCurrentStarters, playerGameState, projectedFinal, resolvePlayer } from '@/lib/league';
import { getUserAvatarUrl } from '@/lib/nfl';
import { getTeamName } from '@/lib/sleeper';
import { formatPoints, formatSigned } from '@/lib/utils';
import RosterPlayerRow from './RosterPlayerRow';

interface TeamSide {
  roster: SleeperRoster;
  matchup: SleeperMatchup;
  name: string;
  avatar: string | null;
  starters: string[];
  actual: number;
  projectedStart: number;
  projectedLive: number;
}

export default function MatchupView({ league, data }: { league: LeagueData; data: FantasyData }) {
  const { userRoster, userMatchup, opponentRoster, opponentMatchup, week } = league;

  if (!userRoster || !userMatchup || !opponentRoster || !opponentMatchup || !week || !league.ownerOf) {
    return (
      <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
        <span className="text-4xl mb-3 block">🏈</span>
        <p className="text-text-secondary">
          {userRoster ? `No head-to-head matchup for week ${week} (bye, playoffs or offseason).` : 'Could not find your team in this league.'}
        </p>
      </div>
    );
  }

  const slots = getStartingSlots(league.league?.roster_positions);

  const buildSide = (roster: SleeperRoster, matchup: SleeperMatchup): TeamSide => {
    const owner = league.ownerOf?.(roster);
    const starters = getCurrentStarters(roster, matchup);
    const actualPoints = matchup.players_points ?? {};
    return {
      roster,
      matchup,
      name: getTeamName(owner, roster.roster_id),
      avatar: owner?.avatar ?? null,
      starters,
      actual: matchup.custom_points ?? matchup.points ?? 0,
      projectedStart: Math.round(starters.reduce((sum, id) => sum + (data.projected.get(id) ?? 0), 0) * 10) / 10,
      projectedLive: projectedFinal({ starterIds: starters, playersById: data.playersById, schedule: data.schedule, week, actualPoints, projected: data.projected }),
    };
  };

  const me = buildSide(userRoster, userMatchup);
  const them = buildSide(opponentRoster, opponentMatchup);
  const started = [me, them].some(side =>
    side.starters.some(id => {
      if (!id || id === '0') return false;
      const state = playerGameState(data.schedule, resolvePlayer(id, data.playersById).team, week, side.matchup.players_points?.[id]);
      return state === 'in_game' || state === 'complete';
    })
  );
  const myScore = started ? me.projectedLive : me.projectedStart;
  const theirScore = started ? them.projectedLive : them.projectedStart;
  const winning = myScore >= theirScore;
  const margin = Math.abs(myScore - theirScore);

  return (
    <div className="space-y-6">
      <div className="bg-field-card/50 border border-field-border rounded-xl p-6">
        <div className="text-center mb-4">
          <h3 className="text-sm text-text-muted uppercase tracking-wide">Week {week} Matchup</h3>
          <p className="text-xs text-text-muted mt-1">{data.scoringLabel}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          {[me, them].map((side, index) => {
            const isMe = index === 0;
            const leading = isMe ? winning : !winning;
            return (
              <div key={side.roster.roster_id} className={`flex-1 text-center ${isMe ? 'order-1' : 'order-3'}`}>
                <div className="relative w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-field-elevated">
                  <Image src={getUserAvatarUrl(side.avatar)} alt={side.name} fill className="object-cover" />
                </div>
                <h4 className="font-semibold text-white truncate">{side.name}</h4>
                {started ? (
                  <>
                    <div className={`stat-number text-3xl mt-2 ${leading ? 'text-turf' : 'text-red'}`}>{formatPoints(side.actual)}</div>
                    <p className="text-text-muted text-sm">Live</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Proj. final <span className="stat-number">{formatPoints(side.projectedLive)}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <div className={`stat-number text-3xl mt-2 ${leading ? 'text-turf' : 'text-red'}`}>{formatPoints(side.projectedStart)}</div>
                    <p className="text-text-muted text-sm">Projected</p>
                  </>
                )}
              </div>
            );
          })}

          <div className="text-center px-2 sm:px-6 order-2">
            <div className="text-2xl font-bold text-text-muted">VS</div>
            <div className={`text-sm mt-2 stat-number ${winning ? 'text-turf' : 'text-red'}`}>{formatSigned(winning ? margin : -margin)}</div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-field-border text-center">
          <span className={`text-lg font-semibold ${winning ? 'text-turf' : 'text-red'}`}>
            {started
              ? winning ? '🏆 On pace to win!' : '😬 Trailing the projection – rally time!'
              : margin < 5 ? '⚠️ Coin-flip matchup – check the Lineup tab for upgrades' : winning ? "🎯 You're projected to win!" : '⚠️ Projected to lose – check the Lineup tab'}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {[me, them].map((side, index) => (
          <div key={side.roster.roster_id} className="bg-field-card/50 border border-field-border rounded-xl p-4">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span aria-hidden>{index === 0 ? '📋' : '👀'}</span>
              {index === 0 ? 'Your Starters' : `${side.name}'s Starters`}
            </h4>
            <div className="space-y-2">
              {side.starters.map((id, slotIndex) => {
                const slot = slotLabel(slots[slotIndex] ?? 'FLEX');
                if (!id || id === '0') return <RosterPlayerRow key={`empty-${slotIndex}`} player={null} slot={slot} />;
                const player = resolvePlayer(id, data.playersById);
                const actual = side.matchup.players_points?.[id] ?? 0;
                const state = playerGameState(data.schedule, player.team, week, actual);
                const projected = data.projected.get(id) ?? 0;
                return (
                  <RosterPlayerRow
                    key={`${id}-${slotIndex}`}
                    player={player}
                    slot={slot}
                    matchup={state === 'pre_game' || state === 'bye' ? data.getMatchup(player, week) : undefined}
                    right={
                      state === 'pre_game' || state === 'bye' ? (
                        <>
                          <div className="stat-number text-sm text-gold">{formatPoints(state === 'bye' ? 0 : projected)}</div>
                          <div className="text-text-muted text-xs">{state === 'bye' ? 'Bye' : 'Projected'}</div>
                        </>
                      ) : (
                        <>
                          <div className={`stat-number text-sm ${actual >= projected ? 'text-turf' : 'text-red'}`}>{formatPoints(actual)}</div>
                          <div className="text-text-muted text-xs">
                            {state === 'in_game' ? 'Live' : 'Final'} · {formatSigned(actual - projected)}
                          </div>
                        </>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
