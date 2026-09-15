import { LineupCandidate, optimizeLineup } from './lineup';

export { blendedValue } from './season';

export interface WaiverPlayerInput {
  id: string;
  position: string;
  positions?: string[];
  /** Projection for the current week (already 0 for bye/out) */
  weekProjection: number;
  /** Longer-term weekly value (blend of projection, season and recent averages) */
  value: number;
}

export interface WaiverSuggestion {
  addId: string;
  dropId: string;
  /** Improvement in optimal lineup value (points per week, longer-term) */
  valueGain: number;
  /** Improvement in this week's optimal lineup projection */
  weekGain: number;
  type: 'upgrade' | 'this-week';
}

/** Best possible lineup total for a set of players using one metric */
export function lineupTotal(slots: string[], players: WaiverPlayerInput[], metric: 'value' | 'weekProjection'): number {
  const candidates: LineupCandidate[] = players.map(p => ({ id: p.id, position: p.position, positions: p.positions, projected: p[metric] }));
  return optimizeLineup({ slots, currentStarters: [], candidates }).optimalTotal;
}

/**
 * Suggest add/drop moves by measuring how much each free agent improves the
 * roster's *optimal* lineup when swapped for a bench player. Starters are never
 * suggested as drops, and roster construction (FLEX, SUPER_FLEX...) is
 * respected automatically because the optimizer fills real league slots.
 */
export function findWaiverSuggestions(params: {
  slots: string[];
  roster: WaiverPlayerInput[];
  /** Roster player IDs that must not be dropped (starters, IR, taxi) */
  protectedIds: Set<string>;
  freeAgents: WaiverPlayerInput[];
  maxFreeAgents?: number;
  dropCandidatesPerAdd?: number;
  limit?: number;
}): WaiverSuggestion[] {
  const { slots, roster, protectedIds, freeAgents, maxFreeAgents = 40, dropCandidatesPerAdd = 5, limit = 8 } = params;
  if (!slots.length || !roster.length) return [];

  const baseValue = lineupTotal(slots, roster, 'value');
  const baseWeek = lineupTotal(slots, roster, 'weekProjection');

  const drops = roster
    .filter(p => !protectedIds.has(p.id))
    .sort((a, b) => a.value - b.value)
    .slice(0, dropCandidatesPerAdd);
  if (!drops.length) return [];

  const pool = [...freeAgents].sort((a, b) => b.value + b.weekProjection - (a.value + a.weekProjection)).slice(0, maxFreeAgents);
  const raw: WaiverSuggestion[] = [];

  for (const fa of pool) {
    let best: WaiverSuggestion | null = null;
    for (const drop of drops) {
      const next = roster.filter(p => p.id !== drop.id).concat(fa);
      const valueGain = Math.round((lineupTotal(slots, next, 'value') - baseValue) * 10) / 10;
      const weekGain = Math.round((lineupTotal(slots, next, 'weekProjection') - baseWeek) * 10) / 10;
      const type = valueGain >= 0.5 ? 'upgrade' : weekGain >= 2 && valueGain > -1 ? 'this-week' : null;
      if (!type) continue;
      const suggestion: WaiverSuggestion = { addId: fa.id, dropId: drop.id, valueGain, weekGain, type };
      if (!best || score(suggestion) > score(best)) best = suggestion;
    }
    if (best) raw.push(best);
  }

  raw.sort((a, b) => score(b) - score(a));
  const usedDrops = new Set<string>();
  const result: WaiverSuggestion[] = [];
  for (const suggestion of raw) {
    if (usedDrops.has(suggestion.dropId)) continue;
    usedDrops.add(suggestion.dropId);
    result.push(suggestion);
    if (result.length >= limit) break;
  }
  return result;
}

function score(s: WaiverSuggestion): number {
  return s.valueGain + s.weekGain * 0.5;
}
