import { Position } from '@/types';

/**
 * Get the CSS class for a position badge
 */
export function getPositionBadgeClass(position: Position): string {
  const classes: Record<Position, string> = {
    QB: 'badge-qb',
    RB: 'badge-rb',
    WR: 'badge-wr',
    TE: 'badge-te',
    K: 'badge-k',
    DEF: 'badge-def',
    DL: 'badge-def',
    LB: 'badge-def',
    DB: 'badge-def',
  };
  return classes[position] || 'badge-def';
}

/**
 * Get position color for charts
 */
export function getPositionColor(position: Position): string {
  const colors: Record<Position, string> = {
    QB: '#ef4444',
    RB: '#10b981',
    WR: '#3b82f6',
    TE: '#f59e0b',
    K: '#a855f7',
    DEF: '#6b7280',
    DL: '#6b7280',
    LB: '#6b7280',
    DB: '#6b7280',
  };
  return colors[position] || '#6b7280';
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format fantasy points display
 */
export function formatPoints(points: number): string {
  return points.toFixed(1);
}

/**
 * Get team display name
 */
export function getTeamDisplayName(abbrev: string): string {
  const teams: Record<string, string> = {
    ARI: 'Arizona Cardinals',
    ATL: 'Atlanta Falcons',
    BAL: 'Baltimore Ravens',
    BUF: 'Buffalo Bills',
    CAR: 'Carolina Panthers',
    CHI: 'Chicago Bears',
    CIN: 'Cincinnati Bengals',
    CLE: 'Cleveland Browns',
    DAL: 'Dallas Cowboys',
    DEN: 'Denver Broncos',
    DET: 'Detroit Lions',
    GB: 'Green Bay Packers',
    HOU: 'Houston Texans',
    IND: 'Indianapolis Colts',
    JAX: 'Jacksonville Jaguars',
    KC: 'Kansas City Chiefs',
    LV: 'Las Vegas Raiders',
    LAC: 'Los Angeles Chargers',
    LAR: 'Los Angeles Rams',
    MIA: 'Miami Dolphins',
    MIN: 'Minnesota Vikings',
    NE: 'New England Patriots',
    NO: 'New Orleans Saints',
    NYG: 'New York Giants',
    NYJ: 'New York Jets',
    PHI: 'Philadelphia Eagles',
    PIT: 'Pittsburgh Steelers',
    SF: 'San Francisco 49ers',
    SEA: 'Seattle Seahawks',
    TB: 'Tampa Bay Buccaneers',
    TEN: 'Tennessee Titans',
    WAS: 'Washington Commanders',
    FA: 'Free Agent',
  };
  return teams[abbrev] || abbrev;
}

/**
 * Get injury status badge color
 */
export function getInjuryStatusColor(status: string | null | undefined): string {
  if (!status) return '';
  
  const colors: Record<string, string> = {
    Out: 'bg-red-500',
    Doubtful: 'bg-red-400',
    Questionable: 'bg-yellow-500',
    Probable: 'bg-green-400',
    IR: 'bg-red-600',
    PUP: 'bg-orange-500',
    Sus: 'bg-purple-500',
  };
  return colors[status] || 'bg-gray-500';
}

/**
 * Debounce function for search
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Calculate percentage for comparison bars
 */
export function calculateBarPercentage(value: number, maxValue: number): number {
  if (maxValue === 0) return 0;
  return Math.min(100, (value / maxValue) * 100);
}

/**
 * Get ordinal suffix for a number
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

