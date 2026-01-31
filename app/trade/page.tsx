'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Player, PlayerWithStats, Position } from '@/types';
import { getFantasyPlayers, getPlayerWithStats } from '@/lib/sleeper';
import { analyzeTrade } from '@/lib/scoring';
import { formatPoints } from '@/lib/utils';
import PlayerCard from '@/components/ui/PlayerCard';
import SearchInput from '@/components/ui/SearchInput';
import PositionFilter from '@/components/ui/PositionFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function TradeContent() {
  const searchParams = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [team1, setTeam1] = useState<PlayerWithStats[]>([]);
  const [team2, setTeam2] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [addingTo, setAddingTo] = useState<1 | 2 | null>(null);

  // Load players
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await getFantasyPlayers();
        setPlayers(data);

        // Check for URL param to add player
        const addId = searchParams.get('add');
        if (addId) {
          const playerData = await getPlayerWithStats(addId);
          if (playerData) {
            setTeam1([playerData]);
          }
        }
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [searchParams]);

  const handleAddPlayer = async (player: Player) => {
    if (!addingTo) return;

    setAdding(true);
    try {
      const fullPlayer = await getPlayerWithStats(player.id);
      if (fullPlayer) {
        if (addingTo === 1) {
          setTeam1(prev => [...prev, fullPlayer]);
        } else {
          setTeam2(prev => [...prev, fullPlayer]);
        }
      }
    } catch (err) {
      console.error('Failed to load player:', err);
    } finally {
      setAdding(false);
      setAddingTo(null);
    }
  };

  const removeFromTeam1 = (playerId: string) => {
    setTeam1(prev => prev.filter(p => p.id !== playerId));
  };

  const removeFromTeam2 = (playerId: string) => {
    setTeam2(prev => prev.filter(p => p.id !== playerId));
  };

  const clearAll = () => {
    setTeam1([]);
    setTeam2([]);
  };

  const filteredPlayers = players.filter(p => {
    const posMatch = selectedPosition === 'ALL' || p.position === selectedPosition;
    const searchMatch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    // Exclude already selected players
    const notSelected = !team1.find(t => t.id === p.id) && !team2.find(t => t.id === p.id);
    return posMatch && searchMatch && notSelected;
  }).slice(0, 20);

  const analysis = team1.length > 0 && team2.length > 0 ? analyzeTrade(team1, team2) : null;

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
        <span className="text-2xl">🔄</span>
        <h2 className="text-xl font-semibold text-white">Trade Analyzer</h2>
        <div className="flex-1 h-px bg-field-border"></div>
        {(team1.length > 0 || team2.length > 0) && (
          <button onClick={clearAll} className="text-sm text-text-muted hover:text-red transition-colors">
            Clear All
          </button>
        )}
      </div>

      <p className="text-text-secondary">
        Add players to each side of the trade to see who comes out ahead.
      </p>

      {/* Trade Sides */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Team 1 (You Give) */}
        <div className="bg-field-card/30 border border-field-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="text-turf">📤</span> You Give
            </h3>
            <button
              onClick={() => setAddingTo(addingTo === 1 ? null : 1)}
              className={`text-sm px-3 py-1 rounded-lg transition-all ${
                addingTo === 1 
                  ? 'bg-turf text-black' 
                  : 'bg-field-card border border-field-border text-text-secondary hover:border-turf'
              }`}
            >
              + Add Player
            </button>
          </div>

          {team1.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p>No players added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {team1.map(player => (
                <div key={player.id} className="relative">
                  <PlayerCard player={player} showStats />
                  <button
                    onClick={() => removeFromTeam1(player.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red/80 text-white rounded-full text-xs hover:bg-red transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {analysis && (
            <div className="mt-4 pt-4 border-t border-field-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Value:</span>
                <span className="stat-number text-turf">{formatPoints(analysis.team1Value)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Team 2 (You Receive) */}
        <div className="bg-field-card/30 border border-field-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="text-gold">📥</span> You Receive
            </h3>
            <button
              onClick={() => setAddingTo(addingTo === 2 ? null : 2)}
              className={`text-sm px-3 py-1 rounded-lg transition-all ${
                addingTo === 2 
                  ? 'bg-gold text-black' 
                  : 'bg-field-card border border-field-border text-text-secondary hover:border-gold'
              }`}
            >
              + Add Player
            </button>
          </div>

          {team2.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p>No players added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {team2.map(player => (
                <div key={player.id} className="relative">
                  <PlayerCard player={player} showStats />
                  <button
                    onClick={() => removeFromTeam2(player.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red/80 text-white rounded-full text-xs hover:bg-red transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {analysis && (
            <div className="mt-4 pt-4 border-t border-field-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Value:</span>
                <span className="stat-number text-gold">{formatPoints(analysis.team2Value)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Player Picker */}
      {addingTo && (
        <div className="bg-field-card/50 border border-field-border rounded-xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">
              Add to {addingTo === 1 ? '"You Give"' : '"You Receive"'}
            </h3>
            <button 
              onClick={() => setAddingTo(null)}
              className="text-text-muted hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <SearchInput placeholder="Search players..." onSearch={setSearchQuery} />
            <PositionFilter selectedPosition={selectedPosition} onPositionChange={setSelectedPosition} />
            
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {adding ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : (
                filteredPlayers.map(p => (
                  <PlayerCard 
                    key={p.id} 
                    player={p} 
                    onClick={() => handleAddPlayer(p)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trade Analysis */}
      {analysis && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-semibold text-white">Trade Analysis</h3>
          </div>

          {/* Result Banner */}
          <div className={`
            text-center p-6 rounded-xl mb-6
            ${analysis.winner === 'team1' ? 'bg-red/20 border border-red' : 
              analysis.winner === 'team2' ? 'bg-turf/20 border border-turf' : 
              'bg-gold/20 border border-gold'}
          `}>
            {analysis.winner === 'fair' ? (
              <>
                <span className="text-4xl mb-2 block">⚖️</span>
                <p className="text-xl font-bold text-gold">Fair Trade</p>
                <p className="text-text-secondary mt-1">This trade is relatively balanced</p>
              </>
            ) : analysis.winner === 'team2' ? (
              <>
                <span className="text-4xl mb-2 block">🎉</span>
                <p className="text-xl font-bold text-turf">You Win This Trade!</p>
                <p className="text-text-secondary mt-1">
                  You gain <span className="text-turf font-semibold">+{formatPoints(analysis.valueDifference)}</span> points of value
                </p>
              </>
            ) : (
              <>
                <span className="text-4xl mb-2 block">⚠️</span>
                <p className="text-xl font-bold text-red">You Lose This Trade</p>
                <p className="text-text-secondary mt-1">
                  You lose <span className="text-red font-semibold">-{formatPoints(analysis.valueDifference)}</span> points of value
                </p>
              </>
            )}
          </div>

          {/* Value Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-field-dark rounded-lg p-4 text-center">
              <p className="text-text-muted text-sm mb-1">You Give</p>
              <p className="stat-number text-2xl text-turf">{formatPoints(analysis.team1Value)}</p>
              <p className="text-xs text-text-muted">{team1.length} player(s)</p>
            </div>
            <div className="bg-field-dark rounded-lg p-4 text-center">
              <p className="text-text-muted text-sm mb-1">You Receive</p>
              <p className="stat-number text-2xl text-gold">{formatPoints(analysis.team2Value)}</p>
              <p className="text-xs text-text-muted">{team2.length} player(s)</p>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-field-dark rounded-lg p-4">
            <p className="text-text-secondary">{analysis.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <TradeContent />
    </Suspense>
  );
}

