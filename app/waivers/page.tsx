'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FANTASY_POSITIONS, IDP_POSITIONS, Position, TrendingPlayer } from '@/types';
import { api } from '@/lib/api';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { findUserRoster, useLeagueRosters, useUserLeagues } from '@/lib/hooks/useUserLeagues';
import { useHydrated } from '@/lib/hooks/useLocalStorage';
import { useQueryParams } from '@/lib/hooks/useQueryParam';
import { getStartingSlots } from '@/lib/lineup';
import { isOnBye } from '@/lib/nfl';
import { strengthOfSchedule, MATCHUP_GRADE_LABELS } from '@/lib/matchups';
import { availabilityFactor } from '@/lib/scoring';
import { blendedValue, findWaiverSuggestions, WaiverPlayerInput } from '@/lib/waivers';
import { isKnownPlayer, leagueHasIdp, resolvePlayer } from '@/lib/league';
import { formatMultiplier, formatPoints, formatSigned, MATCHUP_GRADE_CLASSES } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import PositionFilter from '@/components/ui/PositionFilter';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import PositionBadge from '@/components/ui/PositionBadge';
import InjuryBadge from '@/components/ui/InjuryBadge';
import MatchupBadge from '@/components/ui/MatchupBadge';
import RosterPlayerRow from '@/components/league/RosterPlayerRow';
import LeagueSelect from '@/components/league/LeagueSelect';

type SortKey = 'projected' | 'value' | 'recent' | 'trending';

function WaiversContent() {
  const hydrated = useHydrated();
  const { username, user, leagues, loading: leaguesLoading, error: leaguesError, retry } = useUserLeagues();
  const [params, setParams] = useQueryParams(['league'] as const);
  const [trending, setTrending] = useState<TrendingPlayer[] | null>(null);
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('projected');

  // Trending adds across Sleeper (not league specific)
  useEffect(() => {
    let cancelled = false;
    api
      .trending('add', 24, 100)
      .then(t => !cancelled && setTrending(t))
      .catch(() => !cancelled && setTrending([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Ignore a ?league= that isn't one of the user's leagues (stale or shared link)
  const requestedLeague = params.league && leagues.some(l => l.league_id === params.league) ? params.league : null;
  const unknownLeagueParam = !!params.league && !leaguesLoading && !requestedLeague;
  const leagueId = requestedLeague ?? (leagues.length === 1 ? leagues[0].league_id : null);
  const league = leagues.find(l => l.league_id === leagueId) ?? null;
  const idp = leagueHasIdp(league?.roster_positions);

  const { rosters: leagueRosters, error: rostersError } = useLeagueRosters(leagueId);
  const data = useFantasyData({ scoring: league?.scoring_settings, includeIdp: idp });
  const userRoster = findUserRoster(leagueRosters, user?.user_id);
  const trendingById = useMemo(() => new Map((trending ?? []).map(t => [t.player_id, t.count])), [trending]);
  const week = data.ctx?.week ?? 1;
  const error = leaguesError ?? rostersError;

  const { ready, playersById, seasons, schedule, projected, listedPlayers, players } = data;
  // IDP leagues also consider defensive players on NFL rosters
  const candidatePlayers = useMemo(
    () => (idp ? [...listedPlayers, ...players.filter(p => IDP_POSITIONS.includes(p.position) && p.team !== 'FA')] : listedPlayers),
    [idp, listedPlayers, players]
  );
  const analysis = useMemo(() => {
    if (!leagueRosters || !ready) return null;
    const valuedPositions = idp ? [...FANTASY_POSITIONS, ...IDP_POSITIONS] : FANTASY_POSITIONS;
    const rostered = new Set(leagueRosters.flatMap(r => [...(r.players ?? []), ...(r.reserve ?? []), ...(r.taxi ?? [])]));

    const toInput = (id: string): WaiverPlayerInput & { avg: number; recent: number; games: number } => {
      const player = resolvePlayer(id, playersById);
      const season = seasons.get(id);
      const bye = isOnBye(schedule, player.team, week);
      const projection = projected.get(id) ?? 0;
      return {
        id,
        position: player.position,
        weekProjection: bye ? 0 : projection * availabilityFactor(player.injuryStatus),
        value: blendedValue({
          projection: projection * (player.injuryStatus === 'IR' ? 0.25 : 1),
          avgPoints: season?.avgPoints ?? 0,
          recentAvgPoints: season?.recentAvgPoints ?? 0,
          gamesPlayed: season?.gamesPlayed ?? 0,
        }),
        avg: season?.avgPoints ?? 0,
        recent: season?.recentAvgPoints ?? 0,
        games: season?.gamesPlayed ?? 0,
      };
    };

    const freeAgents = candidatePlayers.filter(p => !rostered.has(p.id)).map(p => toInput(p.id));

    let suggestions: ReturnType<typeof findWaiverSuggestions> = [];
    if (userRoster && league) {
      // Only players we can value: skip IR/taxi, unsupported positions and unknown IDs
      const rosterIds = (userRoster.players ?? []).filter(
        id =>
          !(userRoster.reserve ?? []).includes(id) &&
          !(userRoster.taxi ?? []).includes(id) &&
          isKnownPlayer(id, playersById) &&
          valuedPositions.includes(resolvePlayer(id, playersById).position)
      );
      const starters = new Set((userRoster.starters ?? []).filter(id => id && id !== '0'));
      suggestions = findWaiverSuggestions({
        slots: getStartingSlots(league.roster_positions),
        roster: rosterIds.map(toInput),
        protectedIds: starters,
        freeAgents: freeAgents.filter(fa => fa.weekProjection > 0 || fa.value > 0),
      });
    }
    return { freeAgents, suggestions };
  }, [leagueRosters, ready, playersById, seasons, schedule, projected, candidatePlayers, idp, week, userRoster, league]);

  if (!hydrated) return <LoadingState />;

  if (!username) {
    return (
      <div className="space-y-6">
        <SectionHeader icon="📋" title="Waiver Wire" />
        <div className="bg-field-card/50 border border-field-border rounded-xl p-6 text-center">
          <span className="text-4xl mb-4 block">🔗</span>
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Account</h3>
          <p className="text-text-secondary mb-4">Connect your Sleeper account to see who&apos;s available in your league and get pickup suggestions.</p>
          <Link href="/my-leagues" className="btn-primary inline-block">
            Connect Sleeper Account
          </Link>
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;
  if (leaguesLoading) return <LoadingState message="Loading your leagues..." />;

  const filtered = (analysis?.freeAgents ?? [])
    .filter(fa => position === 'ALL' || fa.position === position)
    .sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return b.value - a.value;
        case 'recent':
          return b.recent - a.recent;
        case 'trending':
          return (trendingById.get(b.id) ?? 0) - (trendingById.get(a.id) ?? 0);
        default:
          return b.weekProjection - a.weekProjection;
      }
    })
    .slice(0, 60);

  const trendingAvailable = (trending ?? [])
    .filter(t => analysis?.freeAgents.some(fa => fa.id === t.player_id))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <SectionHeader icon="📋" title="Waiver Wire" />

      {leagues.length === 0 ? (
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 text-center">
          <p className="text-gold">No active leagues found for @{username}.</p>
        </div>
      ) : (
        leagues.length > 1 && (
          <LeagueSelect leagues={leagues} value={leagueId} onChange={id => setParams({ league: id })} label="Select League" />
        )
      )}

      {unknownLeagueParam && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 text-center text-gold text-sm">
          That league isn&apos;t one of @{username}&apos;s active leagues.{leagues.length > 1 ? ' Choose one above.' : ''}
        </div>
      )}

      {leagueId && (!analysis || data.loading) && <LoadingState message="Analyzing the waiver wire..." />}

      {league && analysis && (
        <>
          <p className="text-text-muted text-sm">
            {league.name} · Week {week} · {data.scoringLabel}
            {league.settings.type === 2 && ' · Dynasty league: weigh long-term value before dropping anyone'}
          </p>

          {/* Suggested moves */}
          <section className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span aria-hidden>🚀</span> Suggested Pickups
            </h3>
            {!userRoster ? (
              <p className="text-text-muted text-sm">We couldn&apos;t find your team in this league, so only available players are shown.</p>
            ) : analysis.suggestions.length === 0 ? (
              <div className="bg-turf/10 border border-turf/30 rounded-xl p-4 text-sm text-text-secondary">
                ✅ No free agent would improve your optimal lineup right now.
              </div>
            ) : (
              <div className="grid gap-3">
                {analysis.suggestions.map(s => {
                  const add = resolvePlayer(s.addId, data.playersById);
                  const drop = resolvePlayer(s.dropId, data.playersById);
                  const trendingCount = trendingById.get(s.addId);
                  return (
                    <div key={`${s.addId}-${s.dropId}`} className="bg-field-card/50 border border-field-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${s.type === 'upgrade' ? 'bg-turf/20 text-turf' : 'bg-gold/20 text-gold'}`}>
                          {s.type === 'upgrade' ? '⬆️ Lineup Upgrade' : '🗓️ This-Week Fill-in'}
                        </span>
                        <span className="text-gold stat-number text-sm">
                          {s.type === 'upgrade' ? `${formatSigned(s.valueGain)} pts/wk` : `${formatSigned(s.weekGain)} pts this week`}
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <RosterPlayerRow
                          player={add}
                          slot="ADD"
                          highlight="add"
                          matchup={data.getMatchup(add)}
                          right={<div className="stat-number text-turf text-sm">{formatPoints(data.projected.get(add.id))}</div>}
                        />
                        <RosterPlayerRow
                          player={drop}
                          slot="DROP"
                          highlight="remove"
                          matchup={data.getMatchup(drop)}
                          right={<div className="stat-number text-red text-sm">{formatPoints(data.projected.get(drop.id))}</div>}
                        />
                      </div>
                      <p className="mt-3 pt-3 border-t border-field-border text-text-secondary text-sm">
                        💡 Swapping {drop.name} for {add.name} changes your best possible lineup by {formatSigned(s.valueGain)} points per week
                        {s.weekGain !== 0 && ` (${formatSigned(s.weekGain)} this week)`}.
                        {trendingCount ? ` Added in ${trendingCount.toLocaleString()} Sleeper leagues in the last 24h.` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Trending */}
          <section className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span aria-hidden>🔥</span> Trending Pickups Available
              <span className="text-text-muted text-sm font-normal">(most added across Sleeper, last 24h)</span>
            </h3>
            {trending === null ? (
              <LoadingState message="Checking trends..." />
            ) : trendingAvailable.length === 0 ? (
              <p className="text-text-muted text-sm">None of today&apos;s most-added players are available in this league.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {trendingAvailable.map(t => {
                  const player = resolvePlayer(t.player_id, data.playersById);
                  return (
                    <RosterPlayerRow
                      key={t.player_id}
                      player={player}
                      matchup={data.getMatchup(player)}
                      right={
                        <>
                          <div className="stat-number text-sm text-gold">+{t.count.toLocaleString()}</div>
                          <div className="text-xs text-text-muted">adds</div>
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Available players */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span aria-hidden>📋</span> Available Players
                <span className="text-text-muted text-sm font-normal">({analysis.freeAgents.length})</span>
              </h3>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-text-muted">Sort by:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="input-field py-1.5 px-2 text-sm w-auto">
                  <option value="projected">Week {week} projection</option>
                  <option value="value">Weekly value</option>
                  <option value="recent">Recent average</option>
                  <option value="trending">Trending adds</option>
                </select>
              </label>
            </div>

            <PositionFilter
              selectedPosition={position}
              onPositionChange={setPosition}
              positions={idp ? ['ALL', ...FANTASY_POSITIONS, ...IDP_POSITIONS] : undefined}
            />

            <div className="bg-field-card/50 border border-field-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-field-elevated/50 border-b border-field-border text-text-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Player</th>
                    <th className="text-left px-4 py-3">Week {week}</th>
                    <th className="text-right px-4 py-3">Proj</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Recent</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Value</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Next 4</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(fa => {
                    const player = resolvePlayer(fa.id, data.playersById);
                    const sos = strengthOfSchedule(data.getUpcoming(player, 4, week + 1));
                    const trend = trendingById.get(fa.id);
                    return (
                      <tr key={fa.id} className="border-b border-field-border/50 hover:bg-field-elevated/30 transition-colors">
                        <td className="px-4 py-2">
                          <Link href={`/players/${fa.id}`} className="flex items-center gap-3 group">
                            <PlayerAvatar id={fa.id} name={player.name} position={player.position} size="xs" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white group-hover:text-turf transition-colors truncate">{player.name}</span>
                                <InjuryBadge player={player} />
                              </div>
                              <div className="flex items-center gap-2 text-xs text-text-muted">
                                <PositionBadge position={player.position} />
                                {player.team}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <MatchupBadge matchup={data.getMatchup(player)} position={player.position} compact />
                        </td>
                        <td className="px-4 py-2 text-right stat-number text-gold">{formatPoints(fa.weekProjection)}</td>
                        <td className="px-4 py-2 text-right stat-number text-cyan hidden sm:table-cell">{fa.games ? formatPoints(fa.recent) : '—'}</td>
                        <td className="px-4 py-2 text-right stat-number text-text-secondary hidden md:table-cell">{formatPoints(fa.value)}</td>
                        <td className="px-4 py-2 hidden md:table-cell">
                          {sos ? (
                            <span className={`px-2 py-0.5 rounded border text-xs ${MATCHUP_GRADE_CLASSES[sos.grade]}`} title={`${formatMultiplier(sos.multiplier)} vs average`}>
                              {MATCHUP_GRADE_LABELS[sos.grade]}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right stat-number text-text-muted hidden sm:table-cell">{trend ? `+${trend.toLocaleString()}` : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function WaiversPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WaiversContent />
    </Suspense>
  );
}
