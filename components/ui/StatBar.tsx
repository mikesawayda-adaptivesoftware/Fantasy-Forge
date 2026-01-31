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
  format = (v) => v.toFixed(1),
  higherIsBetter = true,
  tooltip,
}: StatBarProps) {
  const maxValue = Math.max(value1, value2, 0.1); // Avoid division by zero
  const percent1 = (value1 / maxValue) * 100;
  const percent2 = (value2 / maxValue) * 100;

  const winner = higherIsBetter
    ? value1 > value2 ? 1 : value2 > value1 ? 2 : 0
    : value1 < value2 ? 1 : value2 < value1 ? 2 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary flex items-center gap-1">
          {label}
          {tooltip && (
            <Tooltip content={tooltip}>
              <span className="inline-flex items-center justify-center w-4 h-4 
                              text-xs text-text-muted bg-field-border rounded-full
                              hover:bg-turf/20 hover:text-turf transition-colors">
                ?
              </span>
            </Tooltip>
          )}
        </span>
      </div>
      
      <div className="space-y-1">
        {/* Player 1 bar */}
        <div className="flex items-center gap-3">
          <span className={`w-20 text-sm truncate ${winner === 1 ? 'text-turf font-semibold' : 'text-text-secondary'}`}>
            {player1Name.split(' ').pop()}
          </span>
          <div className="flex-1 h-6 bg-field-dark rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${winner === 1 ? 'bg-turf' : 'bg-field-border'}`}
              style={{ width: `${percent1}%` }}
            />
          </div>
          <span className={`w-16 text-right stat-number ${winner === 1 ? 'text-turf' : 'text-text-secondary'}`}>
            {format(value1)}
          </span>
        </div>

        {/* Player 2 bar */}
        <div className="flex items-center gap-3">
          <span className={`w-20 text-sm truncate ${winner === 2 ? 'text-gold font-semibold' : 'text-text-secondary'}`}>
            {player2Name.split(' ').pop()}
          </span>
          <div className="flex-1 h-6 bg-field-dark rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${winner === 2 ? 'bg-gold' : 'bg-field-border'}`}
              style={{ width: `${percent2}%` }}
            />
          </div>
          <span className={`w-16 text-right stat-number ${winner === 2 ? 'text-gold' : 'text-text-secondary'}`}>
            {format(value2)}
          </span>
        </div>
      </div>
    </div>
  );
}

