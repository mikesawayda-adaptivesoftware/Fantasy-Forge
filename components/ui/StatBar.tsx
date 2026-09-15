'use client';

import Tooltip from './Tooltip';

interface StatBarProps {
  label: string;
  value1: number;
  value2: number;
  player1Name?: string;
  player2Name?: string;
  format?: (value: number) => string;
  higherIsBetter?: boolean;
  tooltip?: string;
}

export default function StatBar({
  label,
  value1,
  value2,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  format = v => v.toFixed(1),
  higherIsBetter = true,
  tooltip,
}: StatBarProps) {
  const maxValue = Math.max(Math.abs(value1), Math.abs(value2), 0.001);
  const percent1 = (Math.max(0, value1) / maxValue) * 100;
  const percent2 = (Math.max(0, value2) / maxValue) * 100;

  const winner = value1 === value2 ? 0 : (value1 > value2) === higherIsBetter ? 1 : 2;

  const rows = [
    { name: player1Name, value: value1, percent: percent1, isWinner: winner === 1, text: 'text-turf', bar: 'bg-turf' },
    { name: player2Name, value: value2, percent: percent2, isWinner: winner === 2, text: 'text-gold', bar: 'bg-gold' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary flex items-center gap-1">
          {label}
          {!higherIsBetter && <span className="text-xs text-text-muted">(lower is better)</span>}
          {tooltip && (
            <Tooltip content={tooltip}>
              <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-text-muted bg-field-border rounded-full hover:bg-turf/20 hover:text-turf transition-colors">
                ?
              </span>
            </Tooltip>
          )}
        </span>
      </div>

      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`w-24 text-sm truncate ${row.isWinner ? `${row.text} font-semibold` : 'text-text-secondary'}`}>
              {row.name.replace(/ DEF$/, '').split(' ').pop()}
            </span>
            <div className="flex-1 h-6 bg-field-dark rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${row.isWinner ? row.bar : 'bg-field-border'}`}
                style={{ width: `${row.percent}%` }}
              />
            </div>
            <span className={`w-16 text-right stat-number ${row.isWinner ? row.text : 'text-text-secondary'}`}>
              {format(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
