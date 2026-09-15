'use client';

import { Suspense, useState } from 'react';
import { Player } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { useQueryParams } from '@/lib/hooks/useQueryParam';
import { getStartSitRecommendation } from '@/lib/scoring';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import PlayerCard from '@/components/ui/PlayerCard';
import PlayerPicker from '@/components/ui/PlayerPicker';
import PlayerSlot from '@/components/ui/PlayerSlot';
import MatchupBadge from '@/components/ui/MatchupBadge';

function StartSitContent() {
  const data = useFantasyData();
  const [params, setParams] = useQueryParams(['player1', 'player2'] as const);
  const [selectingFor, setSelectingFor] = useState<1 | 2 | null>(null);

  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  const player1 = params.player1 ? data.getPlayerWithStats(params.player1) : null;
  const player2 = params.player2 ? data.getPlayerWithStats(params.player2) : null;
  const m1 = player1 ? data.getMatchup(player1) : undefined;
  const m2 = player2 ? data.getMatchup(player2) : undefined;
  const recommendation = player1 && player2 ? getStartSitRecommendation(player1, player2, { matchup: m1 }, { matchup: m2 }) : null;

  const handleSelect = (player: Player) => {
    if (selectingFor) setParams({ [`player${selectingFor}`]: player.id } as { player1?: string; player2?: string });
    setSelectingFor(null);
  };

  // Default the picker to the other player's position – it's still changeable
  const other = selectingFor === 1 ? player2 : player1;
  const matchupFor = (id: string) => (id === player1?.id ? m1 : m2);

  return (
    <div className="space-y-6">
      <SectionHeader icon="🎯" title="Start/Sit Advisor" />

      <p className="text-text-secondary">
        Trying to decide between two players? Add them below for a recommendation based on projections, recent form,
        consistency, injuries, byes and this week&apos;s defensive matchup.
      </p>
      <p className="text-text-muted text-sm">
        Week {data.ctx?.week} · {data.scoringLabel} scoring
      </p>

      <div className="relative grid md:grid-cols-2 gap-6">
        <PlayerSlot
          label="Player 1"
          player={player1}
          accent="turf"
          active={selectingFor === 1}
          onToggle={() => setSelectingFor(selectingFor === 1 ? null : 1)}
          onRemove={() => setParams({ player1: null })}
          meta={player1 && <MatchupBadge matchup={m1} position={player1.position} />}
        />
        <div className="hidden md:flex items-center justify-center absolute inset-y-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="bg-field-dark text-gold font-bold px-3 py-1 rounded-full border border-field-border">VS</span>
        </div>
        <PlayerSlot
          label="Player 2"
          player={player2}
          accent="gold"
          active={selectingFor === 2}
          onToggle={() => setSelectingFor(selectingFor === 2 ? null : 2)}
          onRemove={() => setParams({ player2: null })}
          hint={player1 ? `(Tip: pick a ${player1.position} for an apples-to-apples decision)` : undefined}
          meta={player2 && <MatchupBadge matchup={m2} position={player2.position} />}
        />
      </div>

      {selectingFor && (
        <PlayerPicker
          key={`${selectingFor}-${other?.position ?? 'ALL'}`}
          title={`Select Player ${selectingFor}`}
          players={data.listedPlayers}
          onSelect={handleSelect}
          onClose={() => setSelectingFor(null)}
          excludeIds={[player1?.id, player2?.id].filter(Boolean) as string[]}
          initialPosition={other?.position ?? 'ALL'}
          hint={other ? `Filtered to ${other.position} to match ${other.name}` : undefined}
        />
      )}

      {recommendation && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl" aria-hidden>🏆</span>
            <h3 className="text-lg font-semibold text-white">Recommendation</h3>
            {recommendation.tossUp && <span className="text-xs px-2 py-1 rounded-full bg-gold/20 text-gold">Toss-up</span>}
          </div>

          <div className="bg-turf/20 border border-turf rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-turf text-black px-3 py-1 rounded-full text-sm font-bold">START</span>
              <span className="text-text-secondary text-sm">{recommendation.confidence}% confidence</span>
            </div>
            <PlayerCard
              player={recommendation.start}
              showStats
              meta={<MatchupBadge matchup={matchupFor(recommendation.start.id)} position={recommendation.start.position} />}
            />
          </div>

          <div className="bg-red/10 border border-red/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red text-white px-3 py-1 rounded-full text-sm font-bold">SIT</span>
            </div>
            <PlayerCard
              player={recommendation.sit}
              showStats
              meta={<MatchupBadge matchup={matchupFor(recommendation.sit.id)} position={recommendation.sit.position} />}
            />
          </div>

          <div className="bg-field-dark rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Why?</h4>
            <ul className="space-y-2">
              {recommendation.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-turf">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StartSitPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StartSitContent />
    </Suspense>
  );
}
