'use client';

import { SleeperLeague } from '@/types';

interface LeagueSelectProps {
  leagues: SleeperLeague[];
  value: string | null;
  onChange: (leagueId: string | null) => void;
  /** Label for the "no league" option; omit to require a league */
  emptyLabel?: string;
  label?: string;
}

export default function LeagueSelect({ leagues, value, onChange, emptyLabel = 'Choose a league...', label = 'League' }: LeagueSelectProps) {
  return (
    <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
      <label className="block text-text-muted text-sm mb-2" htmlFor="league-select">
        {label}
      </label>
      <select id="league-select" value={value ?? ''} onChange={e => onChange(e.target.value || null)} className="input-field w-full">
        <option value="">{emptyLabel}</option>
        {leagues.map(l => (
          <option key={l.league_id} value={l.league_id}>
            {l.name} ({l.total_rosters} teams{l.settings.type === 2 ? ', dynasty' : ''})
          </option>
        ))}
      </select>
    </div>
  );
}
