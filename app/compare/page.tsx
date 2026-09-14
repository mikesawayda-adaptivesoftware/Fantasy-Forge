'use client';

import { Suspense, useState } from 'react';
import { Player } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { useQueryParams } from '@/lib/hooks/useQueryParam';
import { comparePlayersHeadToHead } from '@/lib/scoring';
import { formatMultiplier, formatPoints } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import StatBar from '@/components/ui/StatBar';
import PlayerPicker from '@/components/ui/PlayerPicker';
import PlayerSlot from '@/components/ui/PlayerSlot';
import MatchupBadge from '@/components/ui/MatchupBadge';

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
  const [params, setParams] = useQueryParams(['player1', 'player2'] as const);
  const [selectingFor, setSelectingFor] = useState<1 | 2 | null>(null);

  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  const player1 = params.player1 ? data.getPlayerWithStats(params.player1) : null;
  const player2 = params.player2 ? data.getPlayerWithStats(params.player2) : null;
  const m1 = player1 ? data.getMatchup(player1) : undefined;
  const m2 = player2 ? data.getMatchup(player2) : undefined;
  const comparison = player1 && player2 ? comparePlayersHeadToHead(player1, player2, { matchup: m1 }, { matchup: m2 }) : null;

  const handleSelect = (player: Player) => {
    if (selectingFor) setParams({ [`player${selectingFor}`]: player.id } as { player1?: string; player2?: string });
    setSelectingFor(null);
  };

  const badgeFor = (slot: 'player1' | 'player2') => {
    if (!comparison) return null;
    const won = comparison.winner === slot;
    const tie = comparison.winner === 'tie';
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${won ? 'bg-turf text-black' : tie ? 'bg-gold text-black' : 'bg-red/80 text-white'}`}>
        {won ? '👑 WINNER' : tie ? 'TIE' : 'RUNNER-UP'}
      </span>
    );
  };
  const highlightFor = (slot: 'player1' | 'player2') =>
    !comparison || comparison.winner === 'tie' ? null : comparison.winner === slot ? 'winner' : 'loser';

  const winnerName = comparison?.winner === 'player1' ? player1?.name : player2?.name;

  return (
    <div className="space-y-6">
      <SectionHeader icon="⚔️" title="Head-to-Head Comparison" />
      <p className="text-text-muted text-sm">
        Week {data.ctx?.week} · {data.scoringLabel} scoring · the URL updates so you can share this comparison
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <PlayerSlot
          label="Player 1"
          player={player1}
          accent="turf"
          active={selectingFor === 1}
          onToggle={() => setSelectingFor(selectingFor === 1 ? null : 1)}
          onRemove={() => setParams({ player1: null })}
          badge={badgeFor('player1')}
          highlight={highlightFor('player1')}
          meta={player1 && <MatchupBadge matchup={m1} position={player1.position} />}
        />
        <PlayerSlot
          label="Player 2"
          player={player2}
          accent="gold"
          active={selectingFor === 2}
          onToggle={() => setSelectingFor(selectingFor === 2 ? null : 2)}
          onRemove={() => setParams({ player2: null })}
          badge={badgeFor('player2')}
          highlight={highlightFor('player2')}
          meta={player2 && <MatchupBadge matchup={m2} position={player2.position} />}
        />
      </div>

      {selectingFor && (
        <PlayerPicker
          title={`Select Player ${selectingFor}`}
          players={data.listedPlayers}
          onSelect={handleSelect}
          onClose={() => setSelectingFor(null)}
          excludeIds={[player1?.id, player2?.id].filter(Boolean) as string[]}
        />
      )}

      {comparison && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl" aria-hidden>📊</span>
            <h3 className="text-lg font-semibold text-white">Comparison Results</h3>
          </div>

          <div
            className={`text-center p-6 rounded-xl mb-6 ${
              comparison.winner === 'tie'
                ? 'bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 border-2 border-gold'
                : 'bg-gradient-to-r from-turf/30 via-turf/20 to-turf/30 border-2 border-turf shadow-lg shadow-turf/20'
            }`}
          >
            <div className="text-5xl mb-2" aria-hidden>{comparison.winner === 'tie' ? '⚖️' : '🏆'}</div>
            <p className="text-2xl font-bold text-white">
              {comparison.winner === 'tie' ? "It's a toss-up!" : (
                <>
                  <span className="text-turf">{winnerName}</span> wins!
                </>
              )}
            </p>
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span>Confidence</span>
                <span className="font-semibold text-turf">{comparison.confidence}%</span>
              </div>
              <div className="h-2 bg-field-dark rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-turf to-turf-glow rounded-full transition-all duration-500" style={{ width: `${comparison.confidence}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {comparison.breakdown.map(stat => (
              <StatBar
                key={stat.category}
                label={stat.category}
                value1={stat.player1Value}
                value2={stat.player2Value}
                player1Name={player1?.name}
                player2Name={player2?.name}
                format={FORMATTERS[stat.format]}
                higherIsBetter={stat.higherIsBetter}
                tooltip={TOOLTIPS[stat.category]}
              />
            ))}
          </div>
          {comparison.breakdown.length < 5 && (
            <p className="text-xs text-text-muted mt-6">
              Some categories are hidden because one of the players doesn&apos;t have enough games or matchup data yet.
            </p>
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
