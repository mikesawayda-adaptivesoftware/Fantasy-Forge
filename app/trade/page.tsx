'use client';

import { Suspense, useMemo, useState } from 'react';
import { Player, PlayerWithStats, TradePlayerValue } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { parseIdList, useQueryParams } from '@/lib/hooks/useQueryParam';
import { analyzeTrade, computeReplacementLevels } from '@/lib/scoring';
import { formatPoints } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import PlayerCard from '@/components/ui/PlayerCard';
import PlayerPicker from '@/components/ui/PlayerPicker';

type Side = 'give' | 'receive';

function TradeContent() {
  const data = useFantasyData();
  const [params, setParams] = useQueryParams(['give', 'receive'] as const);
  const [addingTo, setAddingTo] = useState<Side | null>(null);

  const { listedPlayers, getPlayerWithStats } = data;
  const replacementLevels = useMemo(
    () => computeReplacementLevels(listedPlayers.map(p => getPlayerWithStats(p.id)).filter((p): p is PlayerWithStats => p !== null)),
    [listedPlayers, getPlayerWithStats]
  );

  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  const giveIds = parseIdList(params.give);
  const receiveIds = parseIdList(params.receive);
  const toPlayers = (ids: string[]) => ids.map(id => getPlayerWithStats(id)).filter((p): p is PlayerWithStats => p !== null);
  const give = toPlayers(giveIds);
  const receive = toPlayers(receiveIds);
  const analysis = give.length > 0 && receive.length > 0 ? analyzeTrade(give, receive, replacementLevels) : null;

  const setSide = (side: Side, ids: string[]) => setParams({ [side]: ids.join(',') || null } as Partial<Record<Side, string | null>>);

  const handleAdd = (player: Player) => {
    if (!addingTo) return;
    setSide(addingTo, [...(addingTo === 'give' ? giveIds : receiveIds), player.id]);
    setAddingTo(null);
  };

  const valueById = new Map<string, TradePlayerValue>(
    [...(analysis?.givePlayers ?? []), ...(analysis?.receivePlayers ?? [])].map(v => [v.player.id, v])
  );

  const renderSide = (side: Side) => {
    const players = side === 'give' ? give : receive;
    const ids = side === 'give' ? giveIds : receiveIds;
    const isGive = side === 'give';
    return (
      <div className="bg-field-card/30 border border-field-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className={isGive ? 'text-turf' : 'text-gold'} aria-hidden>{isGive ? '📤' : '📥'}</span>
            {isGive ? 'You Give' : 'You Receive'}
          </h3>
          <button
            type="button"
            onClick={() => setAddingTo(addingTo === side ? null : side)}
            className={`text-sm px-3 py-1 rounded-lg transition-all ${
              addingTo === side
                ? isGive ? 'bg-turf text-black' : 'bg-gold text-black'
                : `bg-field-card border border-field-border text-text-secondary ${isGive ? 'hover:border-turf' : 'hover:border-gold'}`
            }`}
          >
            + Add Player
          </button>
        </div>

        {players.length === 0 ? (
          <div className="text-center py-8 text-text-muted">No players added yet</div>
        ) : (
          <div className="space-y-2">
            {players.map(player => {
              const value = valueById.get(player.id);
              return (
                <div key={player.id} className="relative">
                  <PlayerCard
                    player={player}
                    aside={
                      <div className="text-right flex-shrink-0 mr-6">
                        <div className={`stat-number text-lg ${isGive ? 'text-turf' : 'text-gold'}`}>
                          {value ? formatPoints(value.valueOverReplacement) : formatPoints(player.projectedPoints)}
                        </div>
                        <div className="text-xs text-text-muted">{value ? 'Value' : 'Projected'}</div>
                      </div>
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setSide(side, ids.filter(id => id !== player.id))}
                    aria-label={`Remove ${player.name}`}
                    className="absolute top-2 right-2 w-6 h-6 bg-red/80 text-white rounded-full text-xs hover:bg-red transition-colors"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {analysis && (
          <div className="mt-4 pt-4 border-t border-field-border flex justify-between text-sm">
            <span className="text-text-secondary">Total Value:</span>
            <span className={`stat-number ${isGive ? 'text-turf' : 'text-gold'}`}>
              {formatPoints(isGive ? analysis.giveValue : analysis.receiveValue)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon="🔄" title="Trade Analyzer">
        {(give.length > 0 || receive.length > 0) && (
          <button onClick={() => setParams({ give: null, receive: null })} className="text-sm text-text-muted hover:text-red transition-colors">
            Clear All
          </button>
        )}
      </SectionHeader>

      <p className="text-text-secondary">
        Add players to each side to see who comes out ahead. Players are valued by weekly points <em>over replacement level</em> –
        what you could find on waivers – so trading one star for several bench players is judged fairly.
      </p>
      <p className="text-text-muted text-sm">{data.scoringLabel} scoring · 12-team replacement levels</p>

      <div className="grid md:grid-cols-2 gap-6">
        {renderSide('give')}
        {renderSide('receive')}
      </div>

      {addingTo && (
        <PlayerPicker
          title={`Add to "${addingTo === 'give' ? 'You Give' : 'You Receive'}"`}
          players={data.listedPlayers}
          onSelect={handleAdd}
          onClose={() => setAddingTo(null)}
          excludeIds={[...giveIds, ...receiveIds]}
        />
      )}

      {analysis && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl" aria-hidden>📊</span>
            <h3 className="text-lg font-semibold text-white">Trade Analysis</h3>
          </div>

          <div
            className={`text-center p-6 rounded-xl mb-6 ${
              analysis.winner === 'give' ? 'bg-red/20 border border-red' : analysis.winner === 'receive' ? 'bg-turf/20 border border-turf' : 'bg-gold/20 border border-gold'
            }`}
          >
            {analysis.winner === 'fair' ? (
              <>
                <span className="text-4xl mb-2 block" aria-hidden>⚖️</span>
                <p className="text-xl font-bold text-gold">Fair Trade</p>
              </>
            ) : analysis.winner === 'receive' ? (
              <>
                <span className="text-4xl mb-2 block" aria-hidden>🎉</span>
                <p className="text-xl font-bold text-turf">You Win This Trade!</p>
              </>
            ) : (
              <>
                <span className="text-4xl mb-2 block" aria-hidden>⚠️</span>
                <p className="text-xl font-bold text-red">You Lose This Trade</p>
              </>
            )}
            <p className="text-text-secondary mt-1">{analysis.recommendation}</p>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b border-field-border">
                  <th className="pb-2 pr-4">Player</th>
                  <th className="pb-2 pr-4">Side</th>
                  <th className="pb-2 pr-4 text-right">Weekly value</th>
                  <th className="pb-2 pr-4 text-right">Replacement</th>
                  <th className="pb-2 text-right">Over replacement</th>
                </tr>
              </thead>
              <tbody>
                {[...analysis.givePlayers.map(v => ['Give', v] as const), ...analysis.receivePlayers.map(v => ['Receive', v] as const)].map(([side, v]) => (
                  <tr key={v.player.id} className="border-b border-field-border/50">
                    <td className="py-2 pr-4 text-white">
                      {v.player.name} <span className="text-text-muted text-xs">{v.player.position}</span>
                    </td>
                    <td className={`py-2 pr-4 ${side === 'Give' ? 'text-turf' : 'text-gold'}`}>{side}</td>
                    <td className="py-2 pr-4 text-right stat-number">{formatPoints(v.rawValue)}</td>
                    <td className="py-2 pr-4 text-right stat-number text-text-muted">{formatPoints(v.replacementValue)}</td>
                    <td className="py-2 text-right stat-number text-white">{formatPoints(v.valueOverReplacement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysis.rosterSpotNote && (
            <div className="bg-field-dark rounded-lg p-4 text-text-secondary text-sm">💡 {analysis.rosterSpotNote}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TradeContent />
    </Suspense>
  );
}
