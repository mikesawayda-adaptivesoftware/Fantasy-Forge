'use client';

import { useMemo, useState } from 'react';
import { Player, Position } from '@/types';
import PlayerCard from './PlayerCard';
import SearchInput from './SearchInput';
import PositionFilter from './PositionFilter';

interface PlayerPickerProps {
  title: string;
  players: Player[];
  onSelect: (player: Player) => void;
  onClose: () => void;
  /** Players that can't be picked (already selected) */
  excludeIds?: string[];
  /** Initial position filter */
  initialPosition?: Position | 'ALL';
  hint?: string;
  limit?: number;
}

/** Search + position filter + result list used by Compare, Start/Sit and Trade */
export default function PlayerPicker({ title, players, onSelect, onClose, excludeIds = [], initialPosition = 'ALL', hint, limit = 25 }: PlayerPickerProps) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | 'ALL'>(initialPosition);

  const results = useMemo(() => {
    const excluded = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return players
      .filter(p => !excluded.has(p.id))
      .filter(p => position === 'ALL' || p.position === position)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q)
      .slice(0, limit);
  }, [players, excludeIds, query, position, limit]);

  return (
    <div className="bg-field-card/50 border border-field-border rounded-xl p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
        </div>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-white" aria-label="Close player picker">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <SearchInput placeholder="Search by name or team (e.g. KC)..." onSearch={setQuery} autoFocus />
        <PositionFilter selectedPosition={position} onPositionChange={setPosition} />

        <div className="grid gap-2 max-h-[340px] overflow-y-auto pr-1">
          {results.length === 0 ? (
            <p className="text-center text-text-muted py-6 text-sm">
              No players match{query ? ` "${query}"` : ''}{position !== 'ALL' ? ` at ${position}` : ''}.
            </p>
          ) : (
            results.map(p => <PlayerCard key={p.id} player={p} compact onClick={() => onSelect(p)} />)
          )}
        </div>
      </div>
    </div>
  );
}
