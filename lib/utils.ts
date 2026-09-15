import { Position } from '@/types';
import { MatchupGrade } from './matchups';

/** CSS class for a solid position badge (defined in globals.css) */
export function getPositionBadgeClass(position: Position | string): string {
  const classes: Record<string, string> = {
    QB: 'badge-qb',
    RB: 'badge-rb',
    WR: 'badge-wr',
    TE: 'badge-te',
    K: 'badge-k',
    DEF: 'badge-def',
  };
  return classes[position] || 'badge-def';
}

/** Subtle tinted badge classes for tables and lists */
export function getPositionTintClass(position: Position | string): string {
  const classes: Record<string, string> = {
    QB: 'bg-red/20 text-red',
    RB: 'bg-turf/20 text-turf',
    WR: 'bg-cyan/20 text-cyan',
    TE: 'bg-gold/20 text-gold',
    K: 'bg-purple/20 text-purple',
    DL: 'bg-orange-500/20 text-orange-400',
    LB: 'bg-orange-500/20 text-orange-400',
    DB: 'bg-orange-500/20 text-orange-400',
  };
  return classes[position] || 'bg-text-muted/20 text-text-muted';
}

export function formatPoints(points: number | null | undefined): string {
  return (points ?? 0).toFixed(1);
}

export function formatSigned(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/** Background class for an injury designation badge */
export function getInjuryStatusColor(status: string | null | undefined): string {
  if (!status) return '';
  const colors: Record<string, string> = {
    Out: 'bg-red-500 text-white',
    Doubtful: 'bg-red-400 text-white',
    Questionable: 'bg-yellow-500 text-black',
    Probable: 'bg-green-400 text-black',
    IR: 'bg-red-600 text-white',
    PUP: 'bg-orange-500 text-white',
    Sus: 'bg-purple-500 text-white',
  };
  return colors[status] || 'bg-gray-500 text-white';
}

export const MATCHUP_GRADE_CLASSES: Record<MatchupGrade, string> = {
  great: 'bg-turf/20 text-turf border-turf/40',
  good: 'bg-turf/10 text-turf-glow border-turf/20',
  neutral: 'bg-field-elevated text-text-secondary border-field-border',
  tough: 'bg-gold/10 text-gold border-gold/30',
  brutal: 'bg-red/15 text-red border-red/40',
};

/** Percent label for a multiplier, e.g. 1.12 -> "+12%" */
export function formatMultiplier(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}
