'use client';

import { Position, FANTASY_POSITIONS } from '@/types';
import { getPositionBadgeClass } from '@/lib/utils';

interface PositionFilterProps {
  selectedPosition: Position | 'ALL';
  onPositionChange: (position: Position | 'ALL') => void;
}

export default function PositionFilter({ selectedPosition, onPositionChange }: PositionFilterProps) {
  const positions: (Position | 'ALL')[] = ['ALL', ...FANTASY_POSITIONS];

  return (
    <div className="flex flex-wrap gap-2">
      {positions.map((pos) => (
        <button
          key={pos}
          onClick={() => onPositionChange(pos)}
          className={`
            px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${selectedPosition === pos
              ? pos === 'ALL'
                ? 'bg-turf text-black'
                : `${getPositionBadgeClass(pos as Position)}`
              : 'bg-field-card border border-field-border text-text-secondary hover:border-turf hover:text-turf'
            }
          `}
        >
          {pos}
        </button>
      ))}
    </div>
  );
}

