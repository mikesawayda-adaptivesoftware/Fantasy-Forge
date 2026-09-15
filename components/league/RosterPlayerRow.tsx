import Link from 'next/link';
import { ReactNode } from 'react';
import { Player } from '@/types';
import { MatchupInfo } from '@/lib/matchups';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import PositionBadge from '@/components/ui/PositionBadge';
import InjuryBadge from '@/components/ui/InjuryBadge';
import MatchupBadge from '@/components/ui/MatchupBadge';

interface RosterPlayerRowProps {
  player: Player | null;
  slot?: string;
  matchup?: MatchupInfo;
  right?: ReactNode;
  highlight?: 'add' | 'remove' | null;
}

export default function RosterPlayerRow({ player, slot, matchup, right, highlight }: RosterPlayerRowProps) {
  const tone =
    highlight === 'add' ? 'bg-turf/10 border-turf/40' : highlight === 'remove' ? 'bg-red/10 border-red/30' : 'bg-field-elevated/50 border-transparent';

  const slotBadge = slot && (
    <span className="w-12 text-center text-[11px] font-bold text-text-muted uppercase flex-shrink-0">{slot}</span>
  );

  if (!player) {
    return (
      <div className={`flex items-center gap-3 p-2 rounded-lg border ${tone}`}>
        {slotBadge}
        <span className="text-text-muted text-sm italic">Empty</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg border ${tone}`}>
      {slotBadge}
      <Link href={`/players/${player.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
        <PlayerAvatar id={player.id} name={player.name} position={player.position} size="xs" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white text-sm truncate group-hover:text-turf transition-colors">{player.name}</p>
            <InjuryBadge player={player} />
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
            <PositionBadge position={player.position} />
            <span>{player.team}</span>
            {matchup && <MatchupBadge matchup={matchup} position={player.position} compact />}
          </div>
        </div>
      </Link>
      {right && <div className="text-right flex-shrink-0">{right}</div>}
    </div>
  );
}
