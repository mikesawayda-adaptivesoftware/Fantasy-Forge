'use client';

import { SCORING_FORMAT_LABELS, ScoringFormat } from '@/lib/points';
import { setScoringFormat, useScoringFormat } from '@/lib/hooks/useScoringFormat';

export default function ScoringSelector() {
  const format = useScoringFormat();

  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary">
      <span className="hidden sm:inline">Scoring</span>
      <select
        value={format}
        onChange={e => setScoringFormat(e.target.value as ScoringFormat)}
        className="bg-field-card border border-field-border rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-turf"
        aria-label="Scoring format"
        title="Used outside of league pages. League pages always use that league's scoring."
      >
        {(Object.keys(SCORING_FORMAT_LABELS) as ScoringFormat[]).map(key => (
          <option key={key} value={key}>
            {SCORING_FORMAT_LABELS[key]}
          </option>
        ))}
      </select>
    </label>
  );
}
