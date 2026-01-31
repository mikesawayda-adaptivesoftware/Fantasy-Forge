'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Player, PlayerWithStats, Position } from '@/types';
import { getFantasyPlayers, getPlayerWithStats } from '@/lib/sleeper';
import { comparePlayersHeadToHead } from '@/lib/scoring';
import { formatPoints } from '@/lib/utils';
import PlayerCard from '@/components/ui/PlayerCard';
import SearchInput from '@/components/ui/SearchInput';
import PositionFilter from '@/components/ui/PositionFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatBar from '@/components/ui/StatBar';

function CompareContent() {
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [player1, setPlayer1] = useState<PlayerWithStats | null>(null);
  const [player2, setPlayer2] = useState<PlayerWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [selectingFor, setSelectingFor] = useState<1 | 2 | null>(null);

  // Load players and handle URL params
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await getFantasyPlayers();
        setPlayers(data);

        // Check for URL params
        const p1Id = searchParams.get('player1');
        const p2Id = searchParams.get('player2');

        if (p1Id) {
          const p1Data = await getPlayerWithStats(p1Id);
          if (p1Data) setPlayer1(p1Data);
        }
        if (p2Id) {
          const p2Data = await getPlayerWithStats(p2Id);
          if (p2Data) setPlayer2(p2Data);
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

    setComparing(true);
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
      setComparing(false);
      setSelectingFor(null);
    }
  };

  const filteredPlayers = players.filter(p => {
    const posMatch = selectedPosition === 'ALL' || p.position === selectedPosition;
    const searchMatch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return posMatch && searchMatch;
  }).slice(0, 20);

  const comparison = player1 && player2 ? comparePlayersHeadToHead(player1, player2) : null;

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
        <span className="text-2xl">⚔️</span>
        <h2 className="text-xl font-semibold text-white">Head-to-Head Comparison</h2>
        <div className="flex-1 h-px bg-field-border"></div>
      </div>

      {/* Player Selection */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Player 1 Slot */}
        <div 
          className={`
            relative bg-field-card/50 border-2 rounded-xl p-4 min-h-[120px]
            flex items-center justify-center cursor-pointer transition-all
            ${comparison?.winner === 'player1' 
              ? 'border-turf bg-turf/10 shadow-lg shadow-turf/20' 
              : comparison?.winner === 'player2'
              ? 'border-red/50 bg-red/5'
              : selectingFor === 1 
              ? 'border-turf bg-turf/10 border-dashed' 
              : 'border-field-border hover:border-turf border-dashed'}
          `}
          onClick={() => setSelectingFor(selectingFor === 1 ? null : 1)}
        >
          {/* Winner/Loser Badge */}
          {comparison && player1 && (
            <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold
              ${comparison.winner === 'player1' 
                ? 'bg-turf text-black' 
                : comparison.winner === 'player2'
                ? 'bg-red/80 text-white'
                : 'bg-gold text-black'}`}>
              {comparison.winner === 'player1' ? '👑 WINNER' : comparison.winner === 'player2' ? 'LOSER' : 'TIE'}
            </div>
          )}
          
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

        {/* Player 2 Slot */}
        <div 
          className={`
            relative bg-field-card/50 border-2 rounded-xl p-4 min-h-[120px]
            flex items-center justify-center cursor-pointer transition-all
            ${comparison?.winner === 'player2' 
              ? 'border-turf bg-turf/10 shadow-lg shadow-turf/20' 
              : comparison?.winner === 'player1'
              ? 'border-red/50 bg-red/5'
              : selectingFor === 2 
              ? 'border-gold bg-gold/10 border-dashed' 
              : 'border-field-border hover:border-gold border-dashed'}
          `}
          onClick={() => setSelectingFor(selectingFor === 2 ? null : 2)}
        >
          {/* Winner/Loser Badge */}
          {comparison && player2 && (
            <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold
              ${comparison.winner === 'player2' 
                ? 'bg-turf text-black' 
                : comparison.winner === 'player1'
                ? 'bg-red/80 text-white'
                : 'bg-gold text-black'}`}>
              {comparison.winner === 'player2' ? '👑 WINNER' : comparison.winner === 'player1' ? 'LOSER' : 'TIE'}
            </div>
          )}
          
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
            </div>
          )}
        </div>
      </div>

      {/* Player Picker (when selecting) */}
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
              {comparing ? (
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

      {/* Comparison Results */}
      {comparison && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-semibold text-white">Comparison Results</h3>
          </div>

          {/* Winner Banner */}
          <div className={`
            text-center p-6 rounded-xl mb-6 relative overflow-hidden
            ${comparison.winner === 'player1' ? 'bg-gradient-to-r from-turf/30 via-turf/20 to-turf/30 border-2 border-turf shadow-lg shadow-turf/20' : 
              comparison.winner === 'player2' ? 'bg-gradient-to-r from-turf/30 via-turf/20 to-turf/30 border-2 border-turf shadow-lg shadow-turf/20' : 
              'bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 border-2 border-gold'}
          `}>
            {/* Trophy Icon */}
            {comparison.winner !== 'tie' && (
              <div className="text-5xl mb-2 animate-bounce">🏆</div>
            )}
            
            <p className="text-2xl font-bold text-white">
              {comparison.winner === 'tie' ? (
                <>
                  <span className="text-4xl block mb-2">⚖️</span>
                  It&apos;s a tie!
                </>
              ) : (
                <>
                  <span className="text-turf">
                    {comparison.winner === 'player1' ? player1?.name : player2?.name}
                  </span>
                  {' '}wins!
                </>
              )}
            </p>
            
            {/* Confidence Bar */}
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span>Confidence</span>
                <span className="font-semibold text-turf">{comparison.confidence}%</span>
              </div>
              <div className="h-2 bg-field-dark rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-turf to-turf-glow rounded-full transition-all duration-500"
                  style={{ width: `${comparison.confidence}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stat Breakdown */}
          <div className="space-y-6">
            {comparison.breakdown.map((stat) => {
              const tooltips: Record<string, string> = {
                'Projected Points': 'Expected fantasy points for the upcoming week based on matchup and recent performance.',
                'Season Average': 'Average fantasy points per game across all games played this season.',
                'Recent Form (3wk)': 'Average fantasy points over the last 3 games played (not chronological weeks). Accounts for injuries/bye weeks.',
                'Consistency': 'Standard deviation of weekly points. Lower = more predictable/reliable.',
              };
              
              return (
                <StatBar
                  key={stat.category}
                  label={stat.category}
                  value1={stat.player1Value}
                  value2={stat.player2Value}
                  player1Name={player1?.name}
                  player2Name={player2?.name}
                  format={formatPoints}
                  higherIsBetter={stat.category !== 'Consistency'}
                  tooltip={tooltips[stat.category]}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <CompareContent />
    </Suspense>
  );
}

