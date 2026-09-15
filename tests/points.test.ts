import { describe, expect, it } from 'vitest';
import { calcPoints, describeScoring, SCORING_PRESETS } from '@/lib/points';

// Real Sleeper stat lines (2025 week 5 offense, 2026 week 1 defenses) with Sleeper's own point totals
const FIXTURES = {
  stafford: { pass_yd: 389, pass_td: 3, fum_lost: 1, gp: 1, pts_ppr: 25.56, pts_half_ppr: 25.56, pts_std: 25.56 },
  dicker: { fgm_50p: 1, xpm: 1, gp: 1, pts_ppr: 6, pts_half_ppr: 6, pts_std: 6 },
  mayfield: { pass_yd: 379, pass_td: 2, pass_2pt: 1, rush_yd: 15, gp: 1, pts_ppr: 26.66, pts_half_ppr: 26.66, pts_std: 26.66 },
  egbuka: { rec: 7, rec_yd: 163, rec_td: 1, rec_2pt: 1, gp: 1, pts_ppr: 31.3, pts_half_ppr: 27.8, pts_std: 24.3 },
  mason: { rush_yd: 52, rush_td: 1, rec: 3, rec_yd: 4, fum_lost: 1, gp: 1, pts_ppr: 12.6, pts_half_ppr: 11.1, pts_std: 9.6 },
  balDef: { sack: 2, pts_allow_35p: 1, gp: 1, pts_ppr: -2, pts_half_ppr: -2, pts_std: -2 },
  ariDef: { sack: 2, int: 1, fum_rec: 1, ff: 1, pts_allow_21_27: 1, gp: 1, pts_ppr: 7, pts_half_ppr: 7, pts_std: 7 },
  ari2026Def: { sack: 3, int: 1, fum_rec: 1, ff: 1, blk_kick: 1, pts_allow_14_20: 1, gp: 1, pts_ppr: 11, pts_half_ppr: 11, pts_std: 11 },
  nyg2026Def: { int: 1, pts_allow_14_20: 1, gp: 1, pts_ppr: 3, pts_half_ppr: 3, pts_std: 3 },
};

describe('calcPoints', () => {
  it.each(Object.entries(FIXTURES))('matches Sleeper totals for %s in every preset', (_name, line) => {
    expect(calcPoints(line, SCORING_PRESETS.ppr)).toBeCloseTo(line.pts_ppr, 2);
    expect(calcPoints(line, SCORING_PRESETS.half_ppr)).toBeCloseTo(line.pts_half_ppr, 2);
    expect(calcPoints(line, SCORING_PRESETS.std)).toBeCloseTo(line.pts_std, 2);
  });

  it('does not count Sleeper precomputed totals or unknown keys', () => {
    expect(calcPoints({ pts_ppr: 50, gp: 1, off_snp: 60 }, SCORING_PRESETS.ppr)).toBe(0);
  });

  it('applies custom league scoring (6pt pass TD, TE premium)', () => {
    const league = { ...SCORING_PRESETS.ppr, pass_td: 6, bonus_rec_te: 0.5 };
    expect(calcPoints({ pass_td: 2 }, league)).toBe(12);
    expect(calcPoints({ rec: 4, bonus_rec_te: 4 }, league)).toBe(6);
  });

  it('handles missing stat lines', () => {
    expect(calcPoints(undefined, SCORING_PRESETS.ppr)).toBe(0);
  });
});

describe('describeScoring', () => {
  it('labels presets and customizations', () => {
    expect(describeScoring(SCORING_PRESETS.ppr)).toBe('PPR');
    expect(describeScoring(SCORING_PRESETS.half_ppr)).toBe('Half PPR');
    expect(describeScoring(SCORING_PRESETS.std)).toBe('Standard');
    expect(describeScoring({ ...SCORING_PRESETS.ppr, pass_td: 6, bonus_rec_te: 0.5 })).toBe('PPR, 6pt pass TD, TE+0.5');
  });
});
