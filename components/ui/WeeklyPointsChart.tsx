import { GameLogEntry } from '@/types';

interface WeeklyPointsChartProps {
  gameLog: GameLogEntry[];
  projections?: Record<number, number | undefined>;
  average?: number;
  totalWeeks?: number;
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 28, left: 34 };

/** Actual points per week (bars) vs projection (dots) with a season-average line */
export default function WeeklyPointsChart({ gameLog, projections = {}, average, totalWeeks = 18 }: WeeklyPointsChartProps) {
  if (gameLog.length === 0) return null;
  const lastWeek = Math.max(...gameLog.map(g => g.week), 1);
  const weeks = Math.max(lastWeek, Math.min(totalWeeks, lastWeek));
  const projectionValues = gameLog.map(g => projections[g.week]).filter((v): v is number => typeof v === 'number');
  const maxValue = Math.max(10, ...gameLog.map(g => g.fantasyPoints), ...projectionValues);
  const minValue = Math.min(0, ...gameLog.map(g => g.fantasyPoints));
  const niceMax = Math.ceil(maxValue / 5) * 5;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / weeks;
  const y = (v: number) => PAD.top + plotH - ((v - minValue) / (niceMax - minValue)) * plotH;
  const x = (week: number) => PAD.left + (week - 1) * band + band / 2;
  const ticks = [0, niceMax / 2, niceMax];

  const summary = gameLog.map(g => `Week ${g.week}: ${g.fantasyPoints.toFixed(1)}`).join(', ');

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label={`Fantasy points by week. ${summary}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-field-border)" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
              {t}
            </text>
          </g>
        ))}

        {gameLog.map(g => {
          const barW = Math.max(4, band * 0.6);
          const top = y(Math.max(0, g.fantasyPoints));
          const bottom = y(Math.min(0, g.fantasyPoints));
          const beat = projections[g.week] === undefined || g.fantasyPoints >= (projections[g.week] ?? 0);
          return (
            <g key={g.week}>
              <rect x={x(g.week) - barW / 2} y={top} width={barW} height={Math.max(1, bottom - top)} rx={2} fill={beat ? 'var(--color-turf)' : 'var(--color-red)'} opacity={0.85}>
                <title>{`Week ${g.week}${g.opponent ? ` vs ${g.opponent}` : ''}: ${g.fantasyPoints.toFixed(1)} pts${projections[g.week] !== undefined ? ` (proj ${projections[g.week]!.toFixed(1)})` : ''}`}</title>
              </rect>
            </g>
          );
        })}

        {gameLog.map(g =>
          projections[g.week] !== undefined ? (
            <circle key={`p-${g.week}`} cx={x(g.week)} cy={y(projections[g.week]!)} r={3.5} fill="var(--color-gold)" stroke="var(--color-field-dark)" strokeWidth={1.5} />
          ) : null
        )}

        {average !== undefined && average > 0 && (
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(average)} y2={y(average)} stroke="var(--color-cyan)" strokeWidth={1.5} opacity={0.7} />
        )}

        {Array.from({ length: weeks }, (_, i) => i + 1).map(week => (
          <text key={week} x={x(week)} y={HEIGHT - 10} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">
            {week}
          </text>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-xs text-text-muted mt-1">
        <span><span className="inline-block w-3 h-3 rounded-sm bg-turf align-middle mr-1" />Beat projection</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-red align-middle mr-1" />Missed projection</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-gold align-middle mr-1" />Projection</span>
        {average !== undefined && average > 0 && <span><span className="inline-block w-4 h-0.5 bg-cyan align-middle mr-1" />Season average</span>}
      </figcaption>
    </figure>
  );
}
