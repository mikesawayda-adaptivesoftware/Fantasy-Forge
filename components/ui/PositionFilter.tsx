'use client';

import { Position, FANTASY_POSITIONS } from '@/types';
import { getPositionBadgeClass } from '@/lib/utils';

interface PositionFilterProps {
  selectedPosition: Position | 'ALL';
  onPositionChange: (position: Position | 'ALL') => void;
  positions?: (Position | 'ALL')[];
}

export default function PositionFilter({ selectedPosition, onPositionChange, positions = ['ALL', ...FANTASY_POSITIONS] }: PositionFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by position">
      {positions.map(pos => (
        <button
          key={pos}
          type="button"
          onClick={() => onPositionChange(pos)}
          aria-pressed={selectedPosition === pos}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedPosition === pos
              ? pos === 'ALL'
                ? 'bg-turf text-black'
                : getPositionBadgeClass(pos)
              : 'bg-field-card border border-field-border text-text-secondary hover:border-turf hover:text-turf'
          }`}
        >
          {pos}
        </button>
      ))}
    </div>
  );
}
