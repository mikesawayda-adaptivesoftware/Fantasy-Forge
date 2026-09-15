'use client';

import { Suspense, useState } from 'react';
import { Player } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { parseIdList, useQueryParams } from '@/lib/hooks/useQueryParam';
import { comparePlayersMulti } from '@/lib/scoring';
import { formatMultiplier, formatPoints } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import PlayerPicker from '@/components/ui/PlayerPicker';
import PlayerCard from '@/components/ui/PlayerCard';
import MatchupBadge from '@/components/ui/MatchupBadge';
import MultiStatBar, { COMPARE_COLORS } from '@/components/ui/MultiStatBar';

const MAX_PLAYERS = 4;

const TOOLTIPS: Record<string, string> = {
  'Projected Points': 'Expected fantasy points this week, reduced for injury designations and zero on a bye.',
  'Season Average': 'Average fantasy points per game played this season.',
  'Recent Form (3 games)': 'Average over the last 3 games actually played (skips byes and missed games).',
  Volatility: 'Standard deviation divided by average. Lower means a steadier weekly floor.',
  Matchup: "How many points this week's opponent allows to the position, relative to league average.",
};

const FORMATTERS = {
  points: formatPoints,
  percent: (v: number) => `${Math.round(v * 100)}%`,
  multiplier: formatMultiplier,
};

function CompareContent() {
  const data = useFantasyData();
  const [params, setParams] = useQueryParams(['players', 'player1', 'player2'] as const);
  // Picker target: index of the slot being changed, or 'add' for a new slot
  const [picking, setPicking] = useState<number | 'add' | null>(null);

  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  // Older links used ?player1=&player2=
  const ids = [...new Set([...parseIdList(params.players), params.player1, params.player2].filter((id): id is string => !!id))].slice(0, MAX_PLAYERS);
  const players = ids.map(id => data.getPlayerWithStats(id)).filter((p): p is NonNullable<typeof p> => p !== null);
  const contexts = players.map(p => ({ matchup: data.getMatchup(p) }));
  const result = players.length >= 2 ? comparePlayersMulti(players, contexts) : null;

  // Work from resolved players so unknown IDs in a URL can't shift indexes
  const playerIds = players.map(p => p.id);
  const writeIds = (next: string[]) => setParams({ players: next.join(',') || null, player1: null, player2: null });

  const handleSelect = (player: Player) => {
    if (picking === 'add') writeIds([...playerIds, player.id].slice(0, MAX_PLAYERS));
    else if (typeof picking === 'number') writeIds(playerIds.map((id, i) => (i === picking ? player.id : id)));
    setPicking(null);
  };

  const rankOf = (index: number) => (result ? result.ranking.indexOf(index) + 1 : null);
  const leader = result && !result.tie ? players[result.ranking[0]] : null;

  return (
    <div className="space-y-6">
      <SectionHeader icon="⚔️" title="Player Comparison" />
      <p className="text-text-muted text-sm">
        Week {data.ctx?.week} · {data.scoringLabel} scoring · compare up to {MAX_PLAYERS} players · the URL updates so you can share it
      </p>

      <div className={`grid gap-4 ${players.length >= 3 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'}`}>
        {players.map((player, index) => {
          const color = COMPARE_COLORS[index % COMPARE_COLORS.length];
          const rank = rankOf(index);
          const isLeader = rank === 1 && !result?.tie;
          return (
            <div key={player.id} className={`relative bg-field-card/50 border-2 rounded-xl p-3 ${isLeader ? 'border-turf shadow-lg shadow-turf/20' : 'border-field-border'}`}>
              {rank !== null && (
                <span className={`absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold ${isLeader ? 'bg-turf text-black' : 'bg-field-elevated text-text-secondary'}`}>
                  {isLeader ? '👑 #1' : `#${rank}`}
                </span>
              )}
              <span className={`absolute top-2 right-3 w-2.5 h-2.5 rounded-full ${color.bar}`} aria-hidden />
              <PlayerCard player={player} showStats meta={<MatchupBadge matchup={contexts[index].matchup} position={player.position} compact />} />
              <div className="mt-2 flex gap-4 text-sm">
                <button type="button" onClick={() => setPicking(index)} className="text-text-muted hover:text-turf">
                  Change
                </button>
                <button type="button" onClick={() => writeIds(playerIds.filter((_, i) => i !== index))} className="text-text-muted hover:text-red">
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {players.length < MAX_PLAYERS && (
          <button
            type="button"
            onClick={() => setPicking(picking === 'add' ? null : 'add')}
            aria-expanded={picking === 'add'}
            className={`bg-field-card/50 border-2 border-dashed rounded-xl p-4 min-h-[120px] flex flex-col items-center justify-center transition-all ${
              picking === 'add' ? 'border-turf bg-turf/10' : 'border-field-border hover:border-turf'
            }`}
          >
            <span className="text-3xl mb-1" aria-hidden>➕</span>
            <span className="text-text-secondary">
              {players.length === 0 ? 'Add a player' : players.length === 1 ? 'Add a player to compare' : 'Add another player'}
            </span>
          </button>
        )}
      </div>

      {picking !== null && (
        <PlayerPicker
          key={String(picking)}
          title={picking === 'add' ? 'Add a player' : `Replace ${players[picking]?.name ?? 'player'}`}
          players={data.listedPlayers}
          onSelect={handleSelect}
          onClose={() => setPicking(null)}
          excludeIds={playerIds}
          initialPosition={players[0]?.position ?? 'ALL'}
          hint={players[0] ? `Filtered to ${players[0].position} – change the filter to compare across positions` : undefined}
        />
      )}

      {result && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div
            className={`text-center p-6 rounded-xl mb-6 ${
              result.tie ? 'bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 border-2 border-gold' : 'bg-gradient-to-r from-turf/30 via-turf/20 to-turf/30 border-2 border-turf'
            }`}
          >
            <div className="text-5xl mb-2" aria-hidden>{result.tie ? '⚖️' : '🏆'}</div>
            <p className="text-2xl font-bold text-white">
              {result.tie ? "It's a toss-up at the top!" : (
                <>
                  <span className="text-turf">{leader?.name}</span> {players.length > 2 ? 'ranks first' : 'wins'}
                </>
              )}
            </p>
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span>Confidence{players.length > 2 ? ' (#1 vs #2)' : ''}</span>
                <span className="font-semibold text-turf">{result.confidence}%</span>
              </div>
              <div className="h-2 bg-field-dark rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-turf to-turf-glow rounded-full" style={{ width: `${result.confidence}%` }} />
              </div>
            </div>
            {players.length > 2 && (
              <ol className="mt-4 text-sm text-text-secondary space-y-0.5">
                {result.ranking.map((index, position) => (
                  <li key={index}>
                    {position + 1}. {players[index].name} <span className="stat-number text-text-muted">({result.scores[index].toFixed(1)})</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="space-y-6">
            {result.categories.map(cat => (
              <MultiStatBar
                key={cat.category}
                label={cat.category}
                values={cat.values}
                names={players.map(p => p.name)}
                bestIndex={cat.bestIndex}
                format={FORMATTERS[cat.format]}
                higherIsBetter={cat.higherIsBetter}
                tooltip={TOOLTIPS[cat.category]}
              />
            ))}
          </div>
          {result.categories.length < 5 && (
            <p className="text-xs text-text-muted mt-6">Some categories are hidden because a player doesn&apos;t have enough games or matchup data yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CompareContent />
    </Suspense>
  );
}
