'use client';

import { useMemo, useState } from 'react';
import { FantasyData } from '@/lib/hooks/useFantasyData';
import { LeagueData } from '@/lib/hooks/useLeagueData';
import { useAsync } from '@/lib/hooks/useAsync';
import { api } from '@/lib/api';
import { getLeagueTransactions, getTeamName, SleeperTransaction } from '@/lib/sleeper';
import { resolvePlayer } from '@/lib/league';
import { summarizeTransaction } from '@/lib/transactions';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import PositionBadge from '@/components/ui/PositionBadge';

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  trade: { label: 'Trade', className: 'bg-purple/20 text-purple' },
  waiver: { label: 'Waiver', className: 'bg-gold/20 text-gold' },
  free_agent: { label: 'Free agent', className: 'bg-cyan/20 text-cyan' },
  commissioner: { label: 'Commissioner', className: 'bg-text-muted/20 text-text-muted' },
};

const WEEKS_BACK = 3;

export default function TransactionsView({ league, data }: { league: LeagueData; data: FantasyData }) {
  const [filter, setFilter] = useState<'all' | 'trade' | 'waiver' | 'free_agent'>('all');
  const [trendingOnly, setTrendingOnly] = useState(false);
  const leagueId = league.league?.league_id ?? null;
  const week = league.week ?? 1;
  const weeks = useMemo(() => Array.from({ length: Math.min(WEEKS_BACK, week) }, (_, i) => week - i), [week]);

  const transactions = useAsync(leagueId ? `${leagueId}:${weeks.join(',')}` : null, async () => {
    const lists = await Promise.all(weeks.map(w => getLeagueTransactions(leagueId!, w).catch(() => [] as SleeperTransaction[])));
    return lists.flat().filter(t => t.status === 'complete').sort((a, b) => (b.status_updated ?? b.created) - (a.status_updated ?? a.created));
  });

  const trending = useAsync('trending', () => api.trending('add', 48, 100));
  const trendingIds = useMemo(() => new Set((trending.data ?? []).map(t => t.player_id)), [trending.data]);

  if (transactions.error) return <ErrorState message={transactions.error.message} onRetry={transactions.reload} />;
  if (!transactions.data) return <LoadingState message="Loading transactions..." />;

  const teamName = (rosterId: number) => {
    const roster = league.rosters.find(r => r.roster_id === rosterId);
    return getTeamName(league.ownerOf?.(roster) ?? null, rosterId);
  };

  const items = transactions.data
    .map(t => summarizeTransaction(t))
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => !trendingOnly || t.moves.some(m => m.kind === 'add' && trendingIds.has(m.playerId)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'trade', 'waiver', 'free_agent'] as const).map(key => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === key ? 'bg-turf text-black' : 'bg-field-card border border-field-border text-text-secondary hover:text-white'}`}
          >
            {key === 'all' ? 'All' : TYPE_LABELS[key].label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-text-secondary ml-auto">
          <input type="checkbox" checked={trendingOnly} onChange={e => setTrendingOnly(e.target.checked)} />
          Only pickups of trending players
        </label>
      </div>

      <p className="text-xs text-text-muted">Weeks {weeks[weeks.length - 1]}–{weeks[0]}</p>

      {items.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-6">No transactions match.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => {
            const type = TYPE_LABELS[item.type] ?? { label: item.type, className: 'bg-field-elevated text-text-secondary' };
            return (
              <li key={item.id} className="bg-field-card/50 border border-field-border rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${type.className}`}>{type.label}</span>
                  <span className="text-xs text-text-muted">
                    Week {item.week} · {new Date(item.timestamp).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {item.bid !== null && ` · $${item.bid} FAAB`}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {item.rosterIds.map(rosterId => (
                    <div key={rosterId}>
                      <p className="text-sm font-medium text-white mb-1">{teamName(rosterId)}</p>
                      <ul className="space-y-1 text-sm">
                        {item.moves
                          .filter(m => m.rosterId === rosterId)
                          .map(m => {
                            const player = resolvePlayer(m.playerId, data.playersById);
                            return (
                              <li key={`${m.kind}-${m.playerId}`} className="flex items-center gap-2">
                                <span className={m.kind === 'add' ? 'text-turf' : 'text-red'}>{m.kind === 'add' ? '+' : '−'}</span>
                                <PositionBadge position={player.position} />
                                <span className="text-text-secondary">{player.name}</span>
                                {m.kind === 'add' && trendingIds.has(m.playerId) && (
                                  <span className="text-xs text-gold" title="Among Sleeper's most-added players this week">🔥</span>
                                )}
                              </li>
                            );
                          })}
                        {item.picks
                          .filter(p => p.toRosterId === rosterId)
                          .map(p => (
                            <li key={`${p.season}-${p.round}-${p.originalRosterId}`} className="text-text-secondary">
                              <span className="text-turf">+</span> 🎟️ {p.season} round {p.round} pick ({teamName(p.originalRosterId)})
                            </li>
                          ))}
                        {item.faab
                          .filter(f => f.toRosterId === rosterId)
                          .map((f, i) => (
                            <li key={`faab-${i}`} className="text-text-secondary">
                              <span className="text-turf">+</span> ${f.amount} FAAB
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
