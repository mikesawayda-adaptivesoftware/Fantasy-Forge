'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Player, PlayerWithStats } from '@/types';
import { formatPoints } from '@/lib/utils';
import PlayerAvatar from './PlayerAvatar';
import PositionBadge from './PositionBadge';
import InjuryBadge from './InjuryBadge';

interface PlayerCardProps {
  player: Player | PlayerWithStats;
  showStats?: boolean;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  /** Extra content under the team line (e.g. a matchup badge) */
  meta?: ReactNode;
  /** Replace the default stats column */
  aside?: ReactNode;
}

export default function PlayerCard({ player, showStats = false, onClick, selected = false, compact = false, meta, aside }: PlayerCardProps) {
  const stats = 'avgPoints' in player ? (player as PlayerWithStats) : null;

  const content = (
    <div
      className={`
        group bg-field-card/50 border rounded-xl text-left w-full
        transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
        ${compact ? 'p-3' : 'p-4'}
        ${selected ? 'border-turf bg-turf/10 shadow-lg shadow-turf/20' : 'border-field-border hover:border-turf'}
      `}
    >
      <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
        <PlayerAvatar id={player.id} name={player.name} position={player.position} size={compact ? 'sm' : 'lg'} />

        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 ${compact ? '' : 'mb-1'}`}>
            <p className={`font-semibold text-white truncate group-hover:text-turf transition-colors ${compact ? 'text-sm' : ''}`}>
              {player.name}
            </p>
            <InjuryBadge player={player} />
          </div>

          <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            <PositionBadge position={player.position} variant="solid" />
            <span className="text-text-secondary">{player.team}</span>
            {!compact && player.number && <span className="text-text-muted">#{player.number}</span>}
            {meta}
          </div>
        </div>

        {aside ??
          (showStats && stats && !compact && (
            <div className="text-right flex-shrink-0">
              <div className="stat-number text-2xl text-gold">{formatPoints(stats.projectedPoints)}</div>
              <div className="text-xs text-text-muted">Projected</div>
              {(stats.gamesPlayed ?? 0) > 0 && (
                <div className="text-sm text-text-secondary mt-1">Avg: {formatPoints(stats.avgPoints)}</div>
              )}
            </div>
          ))}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full" aria-pressed={selected}>
        {content}
      </button>
    );
  }

  return (
    <Link href={`/players/${player.id}`} className="block">
      {content}
    </Link>
  );
}
