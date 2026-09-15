import { Position } from '@/types';

/** Which player positions can fill each Sleeper roster slot */
export const SLOT_ELIGIBILITY: Record<string, Position[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  K: ['K'],
  DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['WR', 'RB'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  DL: ['DL'],
  LB: ['LB'],
  DB: ['DB'],
  IDP_FLEX: ['DL', 'LB', 'DB'],
};

export const SLOT_LABELS: Record<string, string> = {
  FLEX: 'FLEX',
  WRRB_FLEX: 'W/R',
  REC_FLEX: 'W/T',
  SUPER_FLEX: 'SF',
  IDP_FLEX: 'IDP',
};

const NON_STARTING_SLOTS = new Set(['BN', 'IR', 'TAXI']);

export function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? slot;
}

/** Starting slots from a league's roster_positions (drops bench/IR/taxi) */
export function getStartingSlots(rosterPositions: string[] | null | undefined): string[] {
  return (rosterPositions ?? []).filter(slot => !NON_STARTING_SLOTS.has(slot));
}

export function isSlotSupported(slot: string): boolean {
  return slot in SLOT_ELIGIBILITY;
}

export function canFillSlot(slot: string, position: string): boolean {
  return (SLOT_ELIGIBILITY[slot] as string[] | undefined)?.includes(position) ?? false;
}

export interface LineupCandidate {
  id: string;
  position: string;
  /** All eligible positions when a player qualifies at more than one (e.g. LB/DL) */
  positions?: string[];
  projected: number;
  /** Game already started – player can't be moved in or out */
  locked?: boolean;
  /** Why the player shouldn't start (bye, Out, IR...). Projection treated as 0 */
  unavailableReason?: string;
}

export interface SlotAssignment {
  slot: string;
  slotIndex: number;
  playerId: string | null;
  projected: number;
  locked: boolean;
}

export interface LineupMove {
  slot: string;
  slotIndex: number;
  add: LineupCandidate;
  remove: LineupCandidate | null;
  gain: number;
}

export interface LineupOptimization {
  current: SlotAssignment[];
  optimal: SlotAssignment[];
  currentTotal: number;
  optimalTotal: number;
  gain: number;
  moves: LineupMove[];
  /** Current starters who drop out of the optimal lineup */
  benched: LineupCandidate[];
}

export function candidateFits(slot: string, candidate: Pick<LineupCandidate, 'position' | 'positions'>): boolean {
  return (candidate.positions?.length ? candidate.positions : [candidate.position]).some(pos => canFillSlot(slot, pos));
}

function effectiveProjection(candidate: LineupCandidate): number {
  return candidate.unavailableReason ? 0 : Math.max(0, candidate.projected);
}

/**
 * Solve the square assignment problem (maximize total weight) with the
 * Hungarian algorithm. `weights[i][j]` is the value of putting column j in
 * row i; use -Infinity for forbidden pairs. Returns column index per row.
 */
export function maxWeightAssignment(weights: number[][]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const FORBIDDEN = 1e9;
  // Convert to a 1-indexed min-cost matrix
  const cost = (i: number, j: number) => {
    const w = weights[i - 1][j - 1];
    return Number.isFinite(w) ? -w : FORBIDDEN;
  };
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost(i0, j) - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  }
  return assignment;
}

/**
 * Find the highest-projected legal lineup for a set of starting slots.
 *
 * - Players whose game has started are locked where they are.
 * - Unsupported slots (e.g. IDP) keep their current starter.
 * - Current starters get a tiny tie-break bonus so equal projections don't
 *   produce pointless swap suggestions.
 */
export function optimizeLineup(params: {
  slots: string[];
  currentStarters: (string | null)[];
  candidates: LineupCandidate[];
}): LineupOptimization {
  const { slots, candidates } = params;
  const byId = new Map(candidates.map(c => [c.id, c]));
  const currentStarters = slots.map((_, i) => {
    const id = params.currentStarters[i];
    return id && id !== '0' && byId.has(id) ? id : null;
  });

  const current: SlotAssignment[] = slots.map((slot, slotIndex) => {
    const id = currentStarters[slotIndex];
    const candidate = id ? byId.get(id) : undefined;
    return {
      slot,
      slotIndex,
      playerId: id,
      projected: candidate ? effectiveProjection(candidate) : 0,
      locked: !!candidate?.locked || !isSlotSupported(slot),
    };
  });

  const fixedPlayerIds = new Set(current.filter(a => a.locked && a.playerId).map(a => a.playerId as string));
  const openSlots = current.filter(a => !a.locked);
  const pool = candidates.filter(c => !c.locked && !fixedPlayerIds.has(c.id));
  const currentStarterSet = new Set(currentStarters.filter(Boolean) as string[]);

  // Square matrix: rows = open slots + dummy rows, cols = pool + "empty" columns
  const size = openSlots.length + pool.length;
  const weights: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      if (r >= openSlots.length) {
        row.push(0); // dummy row: absorbs unused players / empty columns
      } else if (c >= pool.length) {
        row.push(0); // leave slot empty
      } else {
        const candidate = pool[c];
        const slot = openSlots[r].slot;
        row.push(
          candidateFits(slot, candidate)
            ? effectiveProjection(candidate) + 1e-9 + (currentStarterSet.has(candidate.id) ? 1e-6 : 0)
            : -Infinity
        );
      }
    }
    weights.push(row);
  }

  const assignment = maxWeightAssignment(weights);
  const optimal = current.map(a => ({ ...a }));
  openSlots.forEach((slotAssignment, r) => {
    const c = assignment[r];
    const candidate = c >= 0 && c < pool.length && candidateFits(slotAssignment.slot, pool[c]) ? pool[c] : null;
    optimal[slotAssignment.slotIndex] = {
      ...slotAssignment,
      playerId: candidate?.id ?? null,
      projected: candidate ? effectiveProjection(candidate) : 0,
    };
  });

  // Keep players who are starting in both lineups in their original slot where
  // possible, so the diff only shows real changes.
  alignWithCurrent(current, optimal, byId);

  const currentTotal = round1(current.reduce((sum, a) => sum + a.projected, 0));
  const optimalTotal = round1(optimal.reduce((sum, a) => sum + a.projected, 0));

  const optimalStarterSet = new Set(optimal.map(a => a.playerId).filter(Boolean) as string[]);
  const moves: LineupMove[] = [];
  optimal.forEach((a, i) => {
    if (a.playerId && a.playerId !== current[i].playerId && !currentStarterSet.has(a.playerId)) {
      const currentId = current[i].playerId;
      const removed = currentId && !optimalStarterSet.has(currentId) ? byId.get(currentId) ?? null : null;
      moves.push({
        slot: a.slot,
        slotIndex: i,
        add: byId.get(a.playerId) as LineupCandidate,
        remove: removed,
        gain: round1(a.projected - current[i].projected),
      });
    }
  });

  const benched = [...currentStarterSet]
    .filter(id => !optimalStarterSet.has(id))
    .map(id => byId.get(id) as LineupCandidate);

  return { current, optimal, currentTotal, optimalTotal, gain: round1(optimalTotal - currentTotal), moves, benched };
}

function alignWithCurrent(current: SlotAssignment[], optimal: SlotAssignment[], byId: Map<string, LineupCandidate>) {
  for (let i = 0; i < optimal.length; i++) {
    const wanted = current[i].playerId;
    if (!wanted || optimal[i].playerId === wanted || optimal[i].locked) continue;
    const j = optimal.findIndex((a, idx) => idx !== i && a.playerId === wanted && !a.locked);
    if (j === -1) continue;
    const displacedId = optimal[i].playerId;
    const displaced = displacedId ? byId.get(displacedId) : undefined;
    // The wanted player already fit slot i; make sure the displaced player fits slot j
    if (displaced && !candidateFits(optimal[j].slot, displaced)) continue;
    const a = optimal[i];
    const b = optimal[j];
    optimal[i] = { ...a, playerId: b.playerId, projected: b.projected };
    optimal[j] = { ...b, playerId: a.playerId, projected: a.projected };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
