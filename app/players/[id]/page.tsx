'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { api } from '@/lib/api';
import { calcPoints } from '@/lib/points';
import { formatOpponent, getByeWeek, getTeamDisplayName } from '@/lib/nfl';
import { strengthOfSchedule, MATCHUP_GRADE_LABELS } from '@/lib/matchups';
import { tierFromRank } from '@/lib/season';
import { ordinal, volatility } from '@/lib/scoring';
import { formatMultiplier, formatPoints, formatSigned, MATCHUP_GRADE_CLASSES } from '@/lib/utils';
import { StatsByPlayer } from '@/types';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import PositionBadge from '@/components/ui/PositionBadge';
import InjuryBadge, { formatInjuryUpdated } from '@/components/ui/InjuryBadge';
import MatchupBadge from '@/components/ui/MatchupBadge';
import WeeklyPointsChart from '@/components/ui/WeeklyPointsChart';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlayerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const data = useFantasyData();
  const [weeklyProjections, setWeeklyProjections] = useState<Record<number, StatsByPlayer>>({});

  const ctx = data.ctx;
  const player = data.ready ? data.getPlayerWithStats(id) : null;
  const gameWeeks = player?.gameLog?.map(g => g.week).join(',') ?? '';

  // Past-week projections are only needed here, so load them lazily
  useEffect(() => {
    if (!ctx || !gameWeeks) return;
    let cancelled = false;
    const weeks = gameWeeks.split(',').map(Number);
    Promise.all(weeks.map(week => api.projections(ctx.statsSeason, week).then(p => [week, p] as const).catch(() => null))).then(results => {
      if (cancelled) return;
      setWeeklyProjections(Object.fromEntries(results.filter(Boolean) as [number, StatsByPlayer][]));
    });
    return () => {
      cancelled = true;
    };
  }, [ctx, gameWeeks]);

  if (data.loading) return <LoadingState message="Loading player data..." />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  if (!player || !ctx) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-red">Player not found</p>
        <Link href="/players" className="btn-primary mt-4 inline-block">
          Back to Players
        </Link>
      </div>
    );
  }

  const rank = data.positionRanks.get(player.id);
  const tier = tierFromRank(rank);
  const thisWeek = data.getMatchup(player);
  const upcoming = data.getUpcoming(player, 5);
  const restOfSeason = strengthOfSchedule(data.getUpcoming(player, 18));
  const byeWeek = getByeWeek(data.schedule, player.team);
  const vol = volatility(player);
  const gameLog = player.gameLog ?? [];
  const avgForColors = player.avgPoints || 10;
  const maxPoints = Math.max(20, ...gameLog.map(g => g.fantasyPoints));

  return (
    <div className="space-y-6">
      <Link href="/players" className="inline-flex items-center gap-2 text-cyan hover:text-turf transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Players
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-field-card/50 rounded-xl p-6 border border-field-border">
        <PlayerAvatar id={player.id} name={player.name} position={player.position} size="xl" className="ring-4 ring-turf/30" />

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{player.name}</h1>
            <PositionBadge position={player.position} variant="solid" size="md" />
            <InjuryBadge player={player} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-secondary">
            <span>{getTeamDisplayName(player.team)}</span>
            {player.number && <span>#{player.number}</span>}
            {player.age && <span>{player.age} years old</span>}
            {player.experience !== undefined && <span>{player.experience === 0 ? 'Rookie' : `${player.experience} yrs exp`}</span>}
            {player.college && <span className="text-text-muted">{player.college}</span>}
            {byeWeek && <span className="text-text-muted">Bye: Week {byeWeek}</span>}
          </div>

          {player.injuryStatus && (
            <div className="mt-3 text-sm bg-red/10 border border-red/30 rounded-lg px-3 py-2 text-text-secondary">
              <span className="font-semibold text-red">{player.injuryStatus}</span>
              {player.injuryBodyPart && <span> – {player.injuryBodyPart}</span>}
              {player.injuryNotes && <span className="block text-text-muted">{player.injuryNotes}</span>}
              {formatInjuryUpdated(player.injuryUpdatedAt) && (
                <span className="block text-xs text-text-muted mt-0.5">{formatInjuryUpdated(player.injuryUpdatedAt)}</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center w-full md:w-auto">
          <div className="bg-field-dark rounded-lg p-3">
            <div className="stat-number text-2xl text-gold">{formatPoints(player.projectedPoints)}</div>
            <div className="text-xs text-text-muted">Week {data.week} Proj</div>
          </div>
          <div className="bg-field-dark rounded-lg p-3">
            <div className="stat-number text-2xl text-turf">{formatPoints(player.avgPoints)}</div>
            <div className="text-xs text-text-muted">Season Avg</div>
          </div>
          <div className="bg-field-dark rounded-lg p-3">
            <div className="stat-number text-2xl text-cyan">{rank ? `${player.position}${rank}` : '—'}</div>
            <div className="text-xs text-text-muted">{rank ? `Tier ${tier}` : 'Unranked'}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Matchups */}
        <div className="bg-field-card/30 rounded-xl p-6 border border-field-border">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span aria-hidden>🛡️</span> Matchups
          </h3>

          {thisWeek?.bye ? (
            <p className="text-text-secondary mb-4">On bye in Week {data.week}.</p>
          ) : thisWeek?.game ? (
            <div className={`rounded-lg border p-4 mb-4 ${MATCHUP_GRADE_CLASSES[thisWeek.grade ?? 'neutral']}`}>
              <div className="text-xs uppercase tracking-wide opacity-80">Week {data.week}</div>
              <div className="text-lg font-semibold">
                {formatOpponent(thisWeek.game)} {thisWeek.grade && `· ${MATCHUP_GRADE_LABELS[thisWeek.grade]} matchup`}
              </div>
              {thisWeek.entry ? (
                <p className="text-sm mt-1 text-text-secondary">
                  {thisWeek.opponent} allows {thisWeek.entry.allowedPerGame} PPG to {player.position}s ({ordinal(thisWeek.entry.rank)} most,{' '}
                  {formatMultiplier(thisWeek.entry.multiplier)} vs league average)
                </p>
              ) : (
                <p className="text-sm mt-1 text-text-secondary">Matchup ratings not available yet.</p>
              )}
            </div>
          ) : (
            <p className="text-text-muted mb-4">No game scheduled.</p>
          )}

          <div className="text-sm text-text-muted mb-2">Next {upcoming.length} weeks</div>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(m => (
              <MatchupBadge key={m.week} matchup={m} position={player.position} showWeek compact />
            ))}
          </div>
          {restOfSeason && (
            <p className="text-sm text-text-secondary mt-4">
              Rest-of-season schedule:{' '}
              <span className={`px-2 py-0.5 rounded border text-xs ${MATCHUP_GRADE_CLASSES[restOfSeason.grade]}`}>
                {MATCHUP_GRADE_LABELS[restOfSeason.grade]} ({formatMultiplier(restOfSeason.multiplier)})
              </span>
            </p>
          )}
        </div>

        {/* Season Summary + actions */}
        <div className="bg-field-card/30 rounded-xl p-6 border border-field-border">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span aria-hidden>📊</span> Season Summary
            {ctx.statsSeason !== ctx.season && <span className="text-xs text-text-muted font-normal">({ctx.statsSeason})</span>}
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <SummaryStat label="Games Played" value={String(player.gamesPlayed ?? 0)} color="text-white" />
            <SummaryStat label="Total Points" value={formatPoints(player.totalPoints)} color="text-gold" />
            <SummaryStat label="Recent Avg (3 games)" value={formatPoints(player.recentAvgPoints)} color="text-cyan" />
            <SummaryStat label="Volatility" value={vol === null ? '—' : `${Math.round(vol * 100)}%`} color="text-text-primary" hint="Std. deviation ÷ average (lower is steadier)" />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Link href={`/compare?players=${player.id}`} className="btn-primary text-center text-sm">
              Compare
            </Link>
            <Link href={`/start-sit?player1=${player.id}`} className="btn-secondary text-center text-sm">
              Start/Sit
            </Link>
            <Link href={`/trade?receive=${player.id}`} className="btn-secondary text-center text-sm">
              Trade
            </Link>
          </div>
        </div>
      </div>

      {/* Game Log */}
      <div className="bg-field-card/30 rounded-xl p-6 border border-field-border">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span aria-hidden>📅</span> Game Log
        </h3>

        {gameLog.length > 0 && (
          <div className="mb-6">
            <WeeklyPointsChart
              gameLog={gameLog}
              average={player.avgPoints}
              projections={Object.fromEntries(
                gameLog.map(g => {
                  const projStats = weeklyProjections[g.week]?.[player.id];
                  return [g.week, projStats ? calcPoints(projStats, data.scoring) : undefined];
                })
              )}
            />
          </div>
        )}

        {gameLog.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b border-field-border">
                  <th className="pb-3 pr-4">Week</th>
                  <th className="pb-3 pr-4">Opponent</th>
                  <th className="pb-3 pr-4 text-right">Actual</th>
                  <th className="pb-3 pr-4 text-right">Projected</th>
                  <th className="pb-3 pr-4 text-right">+/-</th>
                  <th className="pb-3 hidden sm:table-cell">Performance</th>
                </tr>
              </thead>
              <tbody>
                {gameLog
                  .slice()
                  .reverse()
                  .map(game => {
                    const projStats = weeklyProjections[game.week]?.[player.id];
                    const projectedPts = projStats ? calcPoints(projStats, data.scoring) : undefined;
                    const performance =
                      game.fantasyPoints >= avgForColors * 1.2 ? 'great' : game.fantasyPoints >= avgForColors * 0.8 ? 'average' : 'poor';
                    const diff = projectedPts !== undefined ? game.fantasyPoints - projectedPts : null;

                    return (
                      <tr key={game.week} className="border-b border-field-border/50">
                        <td className="py-3 pr-4 font-medium text-white">Week {game.week}</td>
                        <td className="py-3 pr-4 text-text-secondary">
                          {game.opponent ? `${game.home === false ? '@' : 'vs'} ${game.opponent}` : '—'}
                          {game.team && game.team !== player.team && <span className="text-xs text-text-muted"> (with {game.team})</span>}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className={`stat-number text-lg ${performance === 'great' ? 'text-turf' : performance === 'poor' ? 'text-red' : 'text-white'}`}>
                            {formatPoints(game.fantasyPoints)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-text-secondary">
                          {projectedPts !== undefined ? formatPoints(projectedPts) : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {diff !== null ? (
                            <span className={`stat-number ${diff >= 0 ? 'text-turf' : 'text-red'}`}>{formatSigned(diff)}</span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 hidden sm:table-cell">
                          <div className="w-full bg-field-dark rounded-full h-2 max-w-[200px]">
                            <div
                              className={`h-2 rounded-full ${performance === 'great' ? 'bg-turf' : performance === 'poor' ? 'bg-red' : 'bg-gold'}`}
                              style={{ width: `${Math.max(0, Math.min(100, (game.fantasyPoints / maxPoints) * 100))}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-secondary text-center py-4">No games played yet this season</p>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div className="bg-field-dark rounded-lg p-3" title={hint}>
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <div className={`stat-number text-xl ${color}`}>{value}</div>
    </div>
  );
}
