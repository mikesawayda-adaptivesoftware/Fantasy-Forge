'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PlayerWithStats } from '@/types';
import { getPlayerWithStats, getHeadshotUrl } from '@/lib/sleeper';
import { getPositionBadgeClass, formatPoints, getTeamDisplayName, getInjuryStatusColor } from '@/lib/utils';
import { getPlayerTier } from '@/lib/scoring';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlayerDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [player, setPlayer] = useState<PlayerWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlayer() {
      try {
        setLoading(true);
        const data = await getPlayerWithStats(resolvedParams.id);
        if (!data) {
          setError('Player not found');
          return;
        }
        setPlayer(data);
      } catch (err) {
        setError('Failed to load player data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadPlayer();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-text-secondary">Loading player data...</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-red">{error || 'Player not found'}</p>
        <Link href="/players" className="btn-primary mt-4 inline-block">
          Back to Players
        </Link>
      </div>
    );
  }

  const tier = player.avgPoints ? getPlayerTier(player.avgPoints, player.position) : 5;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link 
        href="/players"
        className="inline-flex items-center gap-2 text-cyan hover:text-turf transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Players
      </Link>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-field-card/50 rounded-xl p-6 border border-field-border">
        {/* Headshot */}
        <div className="relative w-32 h-32 rounded-full overflow-hidden bg-field-elevated flex-shrink-0 ring-4 ring-turf/30">
          <Image
            src={getHeadshotUrl(player.id, player.position)}
            alt={player.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{player.name}</h1>
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getPositionBadgeClass(player.position)}`}>
              {player.position}
            </span>
            {player.injuryStatus && (
              <span className={`px-2 py-1 text-xs rounded ${getInjuryStatusColor(player.injuryStatus)}`}>
                {player.injuryStatus}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-text-secondary">
            <span>{getTeamDisplayName(player.team)}</span>
            {player.number && <span>#{player.number}</span>}
            {player.age && <span>{player.age} years old</span>}
            {player.experience !== undefined && (
              <span>{player.experience === 0 ? 'Rookie' : `${player.experience} yrs exp`}</span>
            )}
            {player.college && <span className="text-text-muted">{player.college}</span>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-field-dark rounded-lg p-3">
            <div className="stat-number text-2xl text-gold">{formatPoints(player.projectedPoints || 0)}</div>
            <div className="text-xs text-text-muted">Projected</div>
          </div>
          <div className="bg-field-dark rounded-lg p-3">
            <div className="stat-number text-2xl text-turf">{formatPoints(player.avgPoints || 0)}</div>
            <div className="text-xs text-text-muted">Season Avg</div>
          </div>
          <div className="bg-field-dark rounded-lg p-3">
            <div className="stat-number text-2xl text-cyan">Tier {tier}</div>
            <div className="text-xs text-text-muted">{player.position} Rank</div>
          </div>
        </div>
      </div>

      {/* Stats Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Season Summary */}
        <div className="bg-field-card/30 rounded-xl p-6 border border-field-border">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📊</span> Season Summary
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-field-dark rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">Games Played</div>
              <div className="stat-number text-xl text-white">{player.gameLog?.length || 0}</div>
            </div>
            <div className="bg-field-dark rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">Total Points</div>
              <div className="stat-number text-xl text-gold">
                {formatPoints((player.gameLog || []).reduce((sum, g) => sum + g.fantasyPoints, 0))}
              </div>
            </div>
            <div className="bg-field-dark rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">Avg Points</div>
              <div className="stat-number text-xl text-turf">{formatPoints(player.avgPoints || 0)}</div>
            </div>
            <div className="bg-field-dark rounded-lg p-3">
              <div className="text-text-muted text-xs mb-1">Recent Avg (3wk)</div>
              <div className="stat-number text-xl text-cyan">{formatPoints(player.recentAvgPoints || 0)}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-field-card/30 rounded-xl p-6 border border-field-border">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>⚡</span> Quick Actions
          </h3>
          
          <div className="space-y-3">
            <Link 
              href={`/compare?player1=${player.id}`}
              className="block w-full btn-primary text-center"
            >
              Compare with Another Player
            </Link>
            <Link 
              href={`/start-sit?player1=${player.id}`}
              className="block w-full btn-secondary text-center"
            >
              Start/Sit Decision
            </Link>
            <Link 
              href={`/trade?add=${player.id}`}
              className="block w-full btn-secondary text-center"
            >
              Add to Trade Analyzer
            </Link>
          </div>
        </div>
      </div>

      {/* Game Log */}
      <div className="bg-field-card/30 rounded-xl p-6 border border-field-border">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📅</span> Game Log
        </h3>
        
        {player.gameLog && player.gameLog.length > 0 ? (
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
                {player.gameLog.slice().reverse().map((game) => {
                  const avgPoints = player.avgPoints || 10;
                  const performance = game.fantasyPoints >= avgPoints * 1.2 ? 'great' : 
                                      game.fantasyPoints >= avgPoints * 0.8 ? 'average' : 'poor';
                  const diff = game.projectedPoints !== undefined 
                    ? game.fantasyPoints - game.projectedPoints 
                    : null;
                  
                  return (
                    <tr key={game.week} className="border-b border-field-border/50">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-white">Week {game.week}</span>
                      </td>
                      <td className="py-3 pr-4">
                        {game.opponent ? (
                          <span className="text-text-secondary">vs {game.opponent}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`stat-number text-lg ${
                          performance === 'great' ? 'text-turf' : 
                          performance === 'poor' ? 'text-red' : 'text-white'
                        }`}>
                          {formatPoints(game.fantasyPoints)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-text-secondary">
                          {game.projectedPoints !== undefined 
                            ? formatPoints(game.projectedPoints) 
                            : '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {diff !== null ? (
                          <span className={`stat-number ${
                            diff >= 0 ? 'text-turf' : 'text-red'
                          }`}>
                            {diff >= 0 ? '+' : ''}{formatPoints(diff)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 hidden sm:table-cell">
                        <div className="w-full bg-field-dark rounded-full h-2 max-w-[200px]">
                          <div 
                            className={`h-2 rounded-full ${
                              performance === 'great' ? 'bg-turf' : 
                              performance === 'poor' ? 'bg-red' : 'bg-gold'
                            }`}
                            style={{ width: `${Math.min(100, (game.fantasyPoints / 30) * 100)}%` }}
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
          <p className="text-text-secondary text-center py-4">No game data available</p>
        )}
      </div>
    </div>
  );
}

