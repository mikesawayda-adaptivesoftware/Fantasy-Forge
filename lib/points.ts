import { StatLine } from '@/types';

/**
 * Scoring settings are Sleeper stat key -> points per unit. League
 * `scoring_settings` use exactly the same keys as the weekly stat lines, so a
 * player's score is just the dot product of the two.
 */
export type ScoringSettings = Record<string, number>;

export type ScoringFormat = 'ppr' | 'half_ppr' | 'std';

/**
 * Sleeper's default scoring. Verified against the `pts_ppr` / `pts_half_ppr` /
 * `pts_std` values Sleeper returns in its weekly stats and projections (exact
 * match for offensive players, kickers and 2026 team defenses).
 */
const BASE_SCORING: ScoringSettings = {
  // Passing
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -1,
  pass_2pt: 2,
  // Rushing
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  // Receiving (reception value set per format)
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  // Misc offense
  fum_lost: -2,
  // Kicking
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  fgmiss: -1,
  xpm: 1,
  xpmiss: -1,
  // Team defense / special teams
  sack: 1,
  int: 2,
  fum_rec: 2,
  ff: 1,
  def_td: 6,
  safe: 2,
  blk_kick: 2,
  def_st_td: 6,
  def_st_ff: 1,
  def_st_fum_rec: 1,
  st_td: 6,
  st_ff: 1,
  st_fum_rec: 1,
  pts_allow_0: 10,
  pts_allow_1_6: 7,
  pts_allow_7_13: 4,
  pts_allow_14_20: 1,
  pts_allow_21_27: 0,
  pts_allow_28_34: -1,
  pts_allow_35p: -4,
};

export const SCORING_PRESETS: Record<ScoringFormat, ScoringSettings> = {
  ppr: { ...BASE_SCORING, rec: 1 },
  half_ppr: { ...BASE_SCORING, rec: 0.5 },
  std: { ...BASE_SCORING, rec: 0 },
};

export const SCORING_FORMAT_LABELS: Record<ScoringFormat, string> = {
  ppr: 'PPR',
  half_ppr: 'Half PPR',
  std: 'Standard',
};

export function isScoringFormat(value: unknown): value is ScoringFormat {
  return value === 'ppr' || value === 'half_ppr' || value === 'std';
}

/** Fantasy points for a stat line (actual or projected) */
export function calcPoints(stats: StatLine | null | undefined, scoring: ScoringSettings): number {
  if (!stats) return 0;
  let total = 0;
  for (const key in scoring) {
    const value = stats[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value * scoring[key];
    }
  }
  return Math.round(total * 100) / 100;
}

/** Short human label for a scoring setup, e.g. "Half PPR" or "Custom (PPR, TE+0.5)" */
export function describeScoring(scoring: ScoringSettings): string {
  const rec = scoring.rec ?? 0;
  const base = rec >= 1 ? 'PPR' : rec >= 0.5 ? 'Half PPR' : rec > 0 ? `${rec} PPR` : 'Standard';
  const extras: string[] = [];
  if ((scoring.pass_td ?? 4) !== 4) extras.push(`${scoring.pass_td}pt pass TD`);
  if (scoring.bonus_rec_te) extras.push(`TE+${scoring.bonus_rec_te}`);
  return extras.length ? `${base}, ${extras.join(', ')}` : base;
}

/** Stable cache key for a scoring settings object */
export function scoringKey(scoring: ScoringSettings): string {
  return Object.keys(scoring)
    .sort()
    .map(key => `${key}:${scoring[key]}`)
    .join('|');
}
