'use client';

import { isScoringFormat, ScoringFormat } from '@/lib/points';
import { useLocalStorageValue, writeLocalStorage } from './useLocalStorage';

const SCORING_KEY = 'ff_scoring_format';

export function useScoringFormat(): ScoringFormat {
  const value = useLocalStorageValue(SCORING_KEY);
  return isScoringFormat(value) ? value : 'ppr';
}

export function setScoringFormat(format: ScoringFormat) {
  writeLocalStorage(SCORING_KEY, format);
}
