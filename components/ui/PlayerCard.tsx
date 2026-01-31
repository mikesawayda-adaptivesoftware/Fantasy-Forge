'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Player, PlayerWithStats } from '@/types';
import { getPositionBadgeClass, formatPoints, getInjuryStatusColor } from '@/lib/utils';
import { getHeadshotUrl } from '@/lib/sleeper';

interface PlayerCardProps {
  player: Player | PlayerWithStats;
  showStats?: boolean;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export default function PlayerCard({ player, showStats = false, onClick, selected = false, compact = false }: PlayerCardProps) {
  const hasStats = 'avgPoints' in player;
  const playerWithStats = hasStats ? (player as PlayerWithStats) : null;

  const content = (
    <div
      className={`
        group bg-field-card/50 border rounded-xl
        transition-all duration-200 hover:shadow-lg hover:-translate-y-1
        ${compact ? 'p-3' : 'p-4'}
        ${selected 
          ? 'border-turf bg-turf/10 shadow-lg shadow-turf/20' 
          : 'border-field-border hover:border-turf'
        }
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
        {/* Player Headshot */}
        <div className={`relative rounded-full overflow-hidden bg-field-elevated flex-shrink-0 ${
          compact ? 'w-10 h-10' : 'w-16 h-16'
        }`}>
          <Image
            src={getHeadshotUrl(player.id, player.position)}
            alt={player.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 ${compact ? '' : 'mb-1'}`}>
            <h3 className={`font-semibold text-white truncate group-hover:text-turf transition-colors ${
              compact ? 'text-sm' : ''
            }`}>
              {player.name}
            </h3>
            {player.injuryStatus && (
              <span className={`px-1.5 py-0.5 text-xs rounded ${getInjuryStatusColor(player.injuryStatus)}`}>
                {player.injuryStatus}
              </span>
            )}
          </div>
          
          <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionBadgeClass(player.position)}`}>
              {player.position}
            </span>
            <span className="text-text-secondary">{player.team}</span>
            {!compact && player.number && (
              <span className="text-text-muted">#{player.number}</span>
            )}
          </div>
        </div>

        {/* Stats (if available) */}
        {showStats && playerWithStats && !compact && (
          <div className="text-right flex-shrink-0">
            <div className="stat-number text-2xl text-gold">
              {formatPoints(playerWithStats.projectedPoints || 0)}
            </div>
            <div className="text-xs text-text-muted">Projected</div>
            {playerWithStats.avgPoints !== undefined && (
              <div className="text-sm text-text-secondary mt-1">
                Avg: {formatPoints(playerWithStats.avgPoints)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // If no onClick, wrap in Link
  if (!onClick) {
    return (
      <Link href={`/players/${player.id}`}>
        {content}
      </Link>
    );
  }

  return content;
}

