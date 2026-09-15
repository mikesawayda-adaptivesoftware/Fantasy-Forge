import Image from 'next/image';
import { SleeperLeagueUser } from '@/types';
import { getUserAvatarUrl } from '@/lib/nfl';
import { getTeamName } from '@/lib/sleeper';

export default function TeamCell({ owner, rosterId, isUser }: { owner: SleeperLeagueUser | null; rosterId: number; isUser: boolean }) {
  const name = getTeamName(owner, rosterId);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-field-elevated flex-shrink-0">
        <Image src={getUserAvatarUrl(owner?.avatar)} alt={name} fill className="object-cover" />
      </div>
      <p className={`font-medium truncate ${isUser ? 'text-turf' : 'text-white'}`}>
        {name}
        {isUser && <span className="ml-2 text-xs">(You)</span>}
      </p>
    </div>
  );
}
