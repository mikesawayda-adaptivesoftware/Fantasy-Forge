import { describe, expect, it } from 'vitest';
import { summarizeTransaction } from '@/lib/transactions';

describe('summarizeTransaction', () => {
  it('normalizes a waiver claim (real Sleeper shape)', () => {
    const summary = summarizeTransaction({
      status: 'complete', type: 'waiver', metadata: { notes: 'Your waiver claim was processed successfully!' }, created: 1539153517833,
      settings: { waiver_bid: 3 }, leg: 5, draft_picks: [], transaction_id: '355639266249850880',
      adds: { '4973': 2 }, drops: { '4993': 2 }, roster_ids: [2], status_updated: 1539155042276, waiver_budget: [],
    });
    expect(summary).toMatchObject({ type: 'waiver', week: 5, bid: 3, rosterIds: [2], timestamp: 1539155042276 });
    expect(summary.moves).toEqual([
      { kind: 'add', playerId: '4973', rosterId: 2 },
      { kind: 'drop', playerId: '4993', rosterId: 2 },
    ]);
  });

  it('captures picks and FAAB in trades', () => {
    const summary = summarizeTransaction({
      status: 'complete', type: 'trade', created: 1, leg: 3, transaction_id: 't', roster_ids: [1, 2],
      adds: { a: 1, b: 2 }, drops: { a: 2, b: 1 },
      draft_picks: [{ season: '2027', round: 1, roster_id: 2, previous_owner_id: 2, owner_id: 1 }],
      waiver_budget: [{ sender: 1, receiver: 2, amount: 10 }],
    });
    expect(summary.picks).toEqual([{ season: '2027', round: 1, originalRosterId: 2, toRosterId: 1 }]);
    expect(summary.faab).toEqual([{ amount: 10, toRosterId: 2 }]);
    expect(summary.bid).toBeNull();
  });
});
