'use client';

import { ReactNode } from 'react';
import { PlayerWithStats } from '@/types';
import PlayerCard from './PlayerCard';

interface PlayerSlotProps {
  label: string;
  player: PlayerWithStats | null;
  active: boolean;
  accent: 'turf' | 'gold';
  onToggle: () => void;
  onRemove: () => void;
  badge?: ReactNode;
  highlight?: 'winner' | 'loser' | null;
  hint?: string;
  meta?: ReactNode;
}

/** Selectable player slot used by Compare and Start/Sit */
export default function PlayerSlot({ label, player, active, accent, onToggle, onRemove, badge, highlight, hint, meta }: PlayerSlotProps) {
  const border =
    highlight === 'winner'
      ? 'border-turf bg-turf/10 shadow-lg shadow-turf/20'
      : highlight === 'loser'
        ? 'border-red/50 bg-red/5'
        : active
          ? accent === 'turf'
            ? 'border-turf bg-turf/10 border-dashed'
            : 'border-gold bg-gold/10 border-dashed'
          : accent === 'turf'
            ? 'border-field-border hover:border-turf border-dashed'
            : 'border-field-border hover:border-gold border-dashed';

  return (
    <div className={`relative bg-field-card/50 border-2 rounded-xl p-4 min-h-[120px] flex items-center justify-center transition-all ${border}`}>
      {badge && <div className="absolute -top-3 left-4">{badge}</div>}

      {player ? (
        <div className="w-full">
          <PlayerCard player={player} showStats meta={meta} />
          <div className="mt-2 flex gap-4 text-sm">
            <button type="button" onClick={onToggle} className="text-text-muted hover:text-turf transition-colors">
              Change
            </button>
            <button type="button" onClick={onRemove} className="text-text-muted hover:text-red transition-colors">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onToggle} className="text-center w-full h-full py-4">
          <span className="text-3xl mb-2 block" aria-hidden>👤</span>
          <span className="text-text-secondary">Click to select {label}</span>
          {hint && <span className="block text-xs text-text-muted mt-1">{hint}</span>}
        </button>
      )}
    </div>
  );
}
