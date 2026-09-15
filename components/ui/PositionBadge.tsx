import { getPositionBadgeClass, getPositionTintClass } from '@/lib/utils';

interface PositionBadgeProps {
  position: string;
  variant?: 'solid' | 'tint';
  size?: 'sm' | 'md';
}

export default function PositionBadge({ position, variant = 'tint', size = 'sm' }: PositionBadgeProps) {
  const color = variant === 'solid' ? getPositionBadgeClass(position) : getPositionTintClass(position);
  const sizing = size === 'md' ? 'px-3 py-1 text-sm rounded-lg' : 'px-2 py-0.5 text-xs rounded';
  const label = position === 'UNKNOWN' ? '?' : position;
  return <span className={`font-bold ${sizing} ${color}`} title={position === 'UNKNOWN' ? 'Player not in the database' : undefined}>{label}</span>;
}
