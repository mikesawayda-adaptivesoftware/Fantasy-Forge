'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FANTASY_POSITIONS, Position, SleeperLeague, SleeperRoster, TrendingPlayer } from '@/types';
import { api } from '@/lib/api';
import { getLeagueRosters, getUserByUsername, getUserLeagues } from '@/lib/sleeper';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { useSavedUsername } from '@/lib/hooks/useSavedUsername';
import { useHydrated } from '@/lib/hooks/useLocalStorage';
import { useQueryParams } from '@/lib/hooks/useQueryParam';
import { getStartingSlots } from '@/lib/lineup';
import { isOnBye } from '@/lib/nfl';
import { strengthOfSchedule, MATCHUP_GRADE_LABELS } from '@/lib/matchups';
import { availabilityFactor } from '@/lib/scoring';
import { blendedValue, findWaiverSuggestions, WaiverPlayerInput } from '@/lib/waivers';
import { isKnownPlayer, resolvePlayer } from '@/lib/league';
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

type SortKey = 'projected' | 'value' | 'recent' | 'trending';

interface LeagueList {
  username: string;
  userId: string | null;
  leagues: SleeperLeague[];
}

function WaiversContent() {
  const hydrated = useHydrated();
  const username = useSavedUsername();
  const [params, setParams] = useQueryParams(['league'] as const);
  const [leagueList, setLeagueList] = useState<LeagueList | null>(null);
  const [rosters, setRosters] = useState<{ leagueId: string; rosters: SleeperRoster[] } | null>(null);
  const [trending, setTrending] = useState<TrendingPlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('projected');

  // Leagues for the saved user
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      const [user, state] = await Promise.all([getUserByUsername(username), api.state()]);
      const leagues = user ? await getUserLeagues(user.user_id, state.league_season) : [];
      const active = leagues.filter(l => l.status === 'in_season');
      if (!cancelled) setLeagueList({ username, userId: user?.user_id ?? null, leagues: active.length ? active : leagues.filter(l => l.status !== 'complete') });
    })().catch(() => !cancelled && setError('Failed to load your leagues'));
    return () => {
      cancelled = true;
    };
  }, [username]);

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

  const leagues = leagueList?.username === username ? leagueList.leagues : [];
  // Ignore a ?league= that isn't one of the user's leagues (stale or shared link)
  const requestedLeague = params.league && leagues.some(l => l.league_id === params.league) ? params.league : null;
  const unknownLeagueParam = !!params.league && !!leagueList && leagueList.username === username && !requestedLeague;
  const leagueId = requestedLeague ?? (leagues.length === 1 ? leagues[0].league_id : null);
  const league = leagues.find(l => l.league_id === leagueId) ?? null;

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    getLeagueRosters(leagueId)
      .then(r => !cancelled && setRosters({ leagueId, rosters: r }))
      .catch(() => !cancelled && setError('Failed to load league rosters'));
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const data = useFantasyData({ scoring: league?.scoring_settings });
  const leagueRosters = rosters?.leagueId === leagueId ? rosters.rosters : null;
  const userRoster = leagueRosters?.find(r => r.owner_id === leagueList?.userId || r.co_owners?.includes(leagueList?.userId ?? '')) ?? null;
  const trendingById = useMemo(() => new Map((trending ?? []).map(t => [t.player_id, t.count])), [trending]);
  const week = data.ctx?.week ?? 1;

  const { ready, playersById, seasons, schedule, projected, listedPlayers } = data;
  const analysis = useMemo(() => {
    if (!leagueRosters || !ready) return null;
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

    const freeAgents = listedPlayers.filter(p => !rostered.has(p.id)).map(p => toInput(p.id));

    let suggestions: ReturnType<typeof findWaiverSuggestions> = [];
    if (userRoster && league) {
      // Only players we can value: skip IR/taxi, IDP and IDs missing from the player DB
      const rosterIds = (userRoster.players ?? []).filter(
        id =>
          !(userRoster.reserve ?? []).includes(id) &&
          !(userRoster.taxi ?? []).includes(id) &&
          isKnownPlayer(id, playersById) &&
          FANTASY_POSITIONS.includes(resolvePlayer(id, playersById).position)
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
  }, [leagueRosters, ready, playersById, seasons, schedule, projected, listedPlayers, week, userRoster, league]);

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

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;
  if (!leagueList || leagueList.username !== username) return <LoadingState message="Loading your leagues..." />;

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
          <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
            <label className="block text-text-muted text-sm mb-2" htmlFor="league-select">
              Select League
            </label>
            <select
              id="league-select"
              value={leagueId ?? ''}
              onChange={e => setParams({ league: e.target.value || null })}
              className="input-field w-full"
            >
              <option value="">Choose a league...</option>
              {leagues.map(l => (
                <option key={l.league_id} value={l.league_id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
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

            <PositionFilter selectedPosition={position} onPositionChange={setPosition} />

            <div className="bg-field-card/50 border border-field-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-field-elevated/50 border-b border-field-border text-text-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Player</th>
                    <th className="text-left px-4 py-3">Week {week}</th>
                    <th className="text-right px-4 py-3">Proj</th>
                    <th className="text-right px-4 py-3">Recent</th>
                    <th className="text-right px-4 py-3">Value</th>
                    <th className="text-left px-4 py-3">Next 4</th>
                    <th className="text-right px-4 py-3">Trend</th>
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
                        <td className="px-4 py-2 text-right stat-number text-cyan">{fa.games ? formatPoints(fa.recent) : '—'}</td>
                        <td className="px-4 py-2 text-right stat-number text-text-secondary">{formatPoints(fa.value)}</td>
                        <td className="px-4 py-2">
                          {sos ? (
                            <span className={`px-2 py-0.5 rounded border text-xs ${MATCHUP_GRADE_CLASSES[sos.grade]}`} title={`${formatMultiplier(sos.multiplier)} vs average`}>
                              {MATCHUP_GRADE_LABELS[sos.grade]}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right stat-number text-text-muted">{trend ? `+${trend.toLocaleString()}` : ''}</td>
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
