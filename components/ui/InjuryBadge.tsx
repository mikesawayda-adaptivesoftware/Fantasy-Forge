import { Player } from '@/types';
import { getInjuryStatusColor } from '@/lib/utils';

type InjuryFields = Pick<Player, 'injuryStatus' | 'injuryBodyPart' | 'injuryNotes' | 'injuryUpdatedAt'>;

/** One-line description, e.g. "Questionable – Hamstring (limited practice)" */
export function describeInjury(player: InjuryFields): string | null {
  if (!player.injuryStatus) return null;
  const parts = [player.injuryStatus];
  if (player.injuryBodyPart) parts.push(`– ${player.injuryBodyPart}`);
  if (player.injuryNotes) parts.push(`(${player.injuryNotes})`);
  return parts.join(' ');
}

export function formatInjuryUpdated(updatedAt: number | undefined, now = Date.now()): string | null {
  if (!updatedAt) return null;
  const minutes = Math.max(0, Math.round((now - updatedAt) / 60_000));
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `updated ${hours}h ago`;
  return `updated ${Math.round(hours / 24)}d ago`;
}

/** Injury designation badge; hover (or long-press) shows body part and notes */
export default function InjuryBadge({ player }: { player: InjuryFields }) {
  const label = describeInjury(player);
  if (!label || !player.injuryStatus) return null;
  return (
    <span
      title={label}
      aria-label={`Injury: ${label}`}
      className={`px-1.5 py-0.5 text-xs rounded font-medium whitespace-nowrap ${getInjuryStatusColor(player.injuryStatus)}`}
    >
      {player.injuryStatus}
      {player.injuryBodyPart && <span className="hidden sm:inline font-normal opacity-90"> · {player.injuryBodyPart}</span>}
    </span>
  );
}
