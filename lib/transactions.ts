import type { SleeperTransaction } from './sleeper';

export interface TransactionMove {
  kind: 'add' | 'drop';
  playerId: string;
  rosterId: number;
}

export interface TransactionSummary {
  id: string;
  type: string;
  week: number;
  timestamp: number;
  rosterIds: number[];
  moves: TransactionMove[];
  picks: { season: string; round: number; originalRosterId: number; toRosterId: number }[];
  faab: { amount: number; toRosterId: number }[];
  bid: number | null;
}

/** Normalize a Sleeper transaction into per-roster adds, drops, picks and FAAB */
export function summarizeTransaction(t: SleeperTransaction): TransactionSummary {
  const moves: TransactionMove[] = [
    ...Object.entries(t.adds ?? {}).map(([playerId, rosterId]) => ({ kind: 'add' as const, playerId, rosterId })),
    ...Object.entries(t.drops ?? {}).map(([playerId, rosterId]) => ({ kind: 'drop' as const, playerId, rosterId })),
  ];
  return {
    id: t.transaction_id,
    type: t.type,
    week: t.leg,
    timestamp: t.status_updated ?? t.created,
    rosterIds: t.roster_ids?.length ? t.roster_ids : [...new Set(moves.map(m => m.rosterId))],
    moves,
    picks: (t.draft_picks ?? []).map(p => ({ season: p.season, round: p.round, originalRosterId: p.roster_id, toRosterId: p.owner_id })),
    faab: (t.waiver_budget ?? []).map(b => ({ amount: b.amount, toRosterId: b.receiver })),
    bid: t.type === 'waiver' && typeof t.settings?.waiver_bid === 'number' ? t.settings.waiver_bid : null,
  };
}
