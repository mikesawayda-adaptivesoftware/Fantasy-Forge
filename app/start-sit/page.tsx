'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Player, PlayerWithStats, Position } from '@/types';
import { getFantasyPlayers, getPlayerWithStats } from '@/lib/sleeper';
import { getStartSitRecommendation } from '@/lib/scoring';
import PlayerCard from '@/components/ui/PlayerCard';
import SearchInput from '@/components/ui/SearchInput';
import PositionFilter from '@/components/ui/PositionFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function StartSitContent() {
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [player1, setPlayer1] = useState<PlayerWithStats | null>(null);
  const [player2, setPlayer2] = useState<PlayerWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [selectingFor, setSelectingFor] = useState<1 | 2 | null>(null);

  // Load players
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await getFantasyPlayers();
        setPlayers(data);

        const p1Id = searchParams.get('player1');
        if (p1Id) {
          const p1Data = await getPlayerWithStats(p1Id);
          if (p1Data) setPlayer1(p1Data);
        }
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [searchParams]);

  const handleSelectPlayer = async (player: Player) => {
    if (!selectingFor) return;

    setAnalyzing(true);
    try {
      const fullPlayer = await getPlayerWithStats(player.id);
      if (fullPlayer) {
        if (selectingFor === 1) {
          setPlayer1(fullPlayer);
        } else {
          setPlayer2(fullPlayer);
        }
      }
    } catch (err) {
      console.error('Failed to load player:', err);
    } finally {
      setAnalyzing(false);
      setSelectingFor(null);
    }
  };

  const filteredPlayers = players.filter(p => {
    const posMatch = selectedPosition === 'ALL' || p.position === selectedPosition;
    const searchMatch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    // For start/sit, suggest same position as first player
    const samePosition = player1 && selectingFor === 2 ? p.position === player1.position : true;
    return posMatch && searchMatch && samePosition;
  }).slice(0, 20);

  const recommendation = player1 && player2 ? getStartSitRecommendation(player1, player2) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎯</span>
        <h2 className="text-xl font-semibold text-white">Start/Sit Advisor</h2>
        <div className="flex-1 h-px bg-field-border"></div>
      </div>

      <p className="text-text-secondary">
        Trying to decide between two players? Add them below and get a recommendation on who to start.
      </p>

      {/* Player Selection */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Player 1 Slot */}
        <div 
          className={`
            bg-field-card/50 border-2 border-dashed rounded-xl p-4 min-h-[120px]
            flex items-center justify-center cursor-pointer transition-all
            ${selectingFor === 1 ? 'border-turf bg-turf/10' : 'border-field-border hover:border-turf'}
          `}
          onClick={() => setSelectingFor(selectingFor === 1 ? null : 1)}
        >
          {player1 ? (
            <div className="w-full">
              <PlayerCard player={player1} showStats />
              <button 
                onClick={(e) => { e.stopPropagation(); setPlayer1(null); }}
                className="mt-2 text-sm text-text-muted hover:text-red transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-3xl mb-2 block">👤</span>
              <p className="text-text-secondary">Click to select Player 1</p>
            </div>
          )}
        </div>

        {/* VS Badge */}
        <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2 z-10">
          <span className="bg-field-dark text-gold font-bold px-3 py-1 rounded-full border border-field-border">
            VS
          </span>
        </div>

        {/* Player 2 Slot */}
        <div 
          className={`
            bg-field-card/50 border-2 border-dashed rounded-xl p-4 min-h-[120px]
            flex items-center justify-center cursor-pointer transition-all
            ${selectingFor === 2 ? 'border-gold bg-gold/10' : 'border-field-border hover:border-gold'}
          `}
          onClick={() => setSelectingFor(selectingFor === 2 ? null : 2)}
        >
          {player2 ? (
            <div className="w-full">
              <PlayerCard player={player2} showStats />
              <button 
                onClick={(e) => { e.stopPropagation(); setPlayer2(null); }}
                className="mt-2 text-sm text-text-muted hover:text-red transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-3xl mb-2 block">👤</span>
              <p className="text-text-secondary">Click to select Player 2</p>
              {player1 && (
                <p className="text-xs text-text-muted mt-1">
                  (Select a {player1.position} for best comparison)
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Player Picker */}
      {selectingFor && (
        <div className="bg-field-card/50 border border-field-border rounded-xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">
              Select Player {selectingFor}
            </h3>
            <button 
              onClick={() => setSelectingFor(null)}
              className="text-text-muted hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <SearchInput placeholder="Search players..." onSearch={setSearchQuery} />
            <PositionFilter selectedPosition={selectedPosition} onPositionChange={setSelectedPosition} />
            
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {analyzing ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : (
                filteredPlayers.map(p => (
                  <PlayerCard 
                    key={p.id} 
                    player={p} 
                    onClick={() => handleSelectPlayer(p)}
                    selected={p.id === player1?.id || p.id === player2?.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🏆</span>
            <h3 className="text-lg font-semibold text-white">Recommendation</h3>
          </div>

          {/* Start Player */}
          <div className="bg-turf/20 border border-turf rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-turf text-black px-3 py-1 rounded-full text-sm font-bold">START</span>
              <span className="text-text-secondary text-sm">
                {recommendation.confidence}% confidence
              </span>
            </div>
            <PlayerCard player={recommendation.start} showStats />
          </div>

          {/* Sit Player */}
          <div className="bg-red/10 border border-red/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red text-white px-3 py-1 rounded-full text-sm font-bold">SIT</span>
            </div>
            <PlayerCard player={recommendation.sit} showStats />
          </div>

          {/* Reasons */}
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
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <StartSitContent />
    </Suspense>
  );
}

