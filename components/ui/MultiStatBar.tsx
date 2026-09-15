'use client';

import Tooltip from './Tooltip';

export const COMPARE_COLORS = [
  { text: 'text-turf', bar: 'bg-turf', border: 'border-turf' },
  { text: 'text-gold', bar: 'bg-gold', border: 'border-gold' },
  { text: 'text-cyan', bar: 'bg-cyan', border: 'border-cyan' },
  { text: 'text-purple', bar: 'bg-purple', border: 'border-purple' },
];

interface MultiStatBarProps {
  label: string;
  values: number[];
  names: string[];
  bestIndex: number | null;
  format: (value: number) => string;
  higherIsBetter?: boolean;
  tooltip?: string;
}

/** One category compared across 2–4 players */
export default function MultiStatBar({ label, values, names, bestIndex, format, higherIsBetter = true, tooltip }: MultiStatBarProps) {
  const max = Math.max(...values.map(Math.abs), 0.001);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        {label}
        {!higherIsBetter && <span className="text-xs text-text-muted">(lower is better)</span>}
        {tooltip && (
          <Tooltip content={tooltip}>
            <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-text-muted bg-field-border rounded-full hover:bg-turf/20 hover:text-turf transition-colors">
              ?
            </span>
          </Tooltip>
        )}
      </div>
      <div className="space-y-1">
        {values.map((value, i) => {
          const best = bestIndex === i;
          const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
          return (
            <div key={i} className="flex items-center gap-3">
              <span className={`w-24 text-sm truncate ${best ? `${color.text} font-semibold` : 'text-text-secondary'}`}>
                {best && <span className="sr-only">Best: </span>}
                {names[i]?.replace(/ DEF$/, '').split(' ').pop()}
              </span>
              <div className="flex-1 h-5 bg-field-dark rounded overflow-hidden">
                <div className={`h-full transition-all duration-500 ${best ? color.bar : 'bg-field-border'}`} style={{ width: `${(Math.max(0, value) / max) * 100}%` }} />
              </div>
              <span className={`w-16 text-right stat-number ${best ? color.text : 'text-text-secondary'}`}>
                {format(value)}
                {best && <span aria-hidden> ★</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
