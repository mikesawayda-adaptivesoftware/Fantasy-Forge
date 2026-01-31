'use client';

import { useState, useEffect } from 'react';
import { Player, Position, PlayerWithStats } from '@/types';
import { 
  getFantasyPlayers, 
  getCurrentSeason, 
  getCurrentWeek,
  fetchWeeklyProjections,
  fetchWeeklyStats,
  calculateFantasyPoints 
} from '@/lib/sleeper';
import PlayerCard from '@/components/ui/PlayerCard';
import SearchInput from '@/components/ui/SearchInput';
import PositionFilter from '@/components/ui/PositionFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type SortOption = 'rank' | 'name' | 'projected' | 'total' | 'average';

interface PlayerWithSeasonStats extends Player {
  projectedPoints?: number;
  totalPoints?: number;
  gamesPlayed?: number;
  avgPoints?: number;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithSeasonStats[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerWithSeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  const [displayCount, setDisplayCount] = useState(50);

  // Load players on mount
  useEffect(() => {
    async function loadPlayers() {
      try {
        setLoading(true);
        const data = await getFantasyPlayers();
        setPlayers(data);
        setFilteredPlayers(data.slice(0, 50));
      } catch (err) {
        setError('Failed to load players. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadPlayers();
  }, []);

  // Load stats when sorting by stats-based option
  useEffect(() => {
    if ((sortBy === 'projected' || sortBy === 'total' || sortBy === 'average') && !statsLoaded && !loadingStats) {
      loadPlayerStats();
    }
  }, [sortBy, statsLoaded, loadingStats]);

  const loadPlayerStats = async () => {
    setLoadingStats(true);
    try {
      const season = getCurrentSeason();
      const currentWeek = getCurrentWeek();
      
      // Fetch projections and all weekly stats in parallel
      const weekPromises = [];
      for (let week = 1; week <= currentWeek; week++) {
        weekPromises.push(fetchWeeklyStats(season, week));
      }
      
      const [projections, ...weeklyStats] = await Promise.all([
        fetchWeeklyProjections(season, currentWeek),
        ...weekPromises,
      ]);

      // Calculate stats for each player
      const playersWithStats = players.map(player => {
        // Get projected points
        const proj = projections[player.id];
        const projectedPoints = proj ? calculateFantasyPoints(proj) : 0;
        
        // Calculate season totals
        let totalPoints = 0;
        let gamesPlayed = 0;
        
        for (const weekStats of weeklyStats) {
          const stats = weekStats[player.id];
          if (stats) {
            const points = calculateFantasyPoints(stats);
            if (points > 0) {
              totalPoints += points;
              gamesPlayed++;
            }
          }
        }
        
        const avgPoints = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;
        
        return {
          ...player,
          projectedPoints: Math.round(projectedPoints * 10) / 10,
          totalPoints: Math.round(totalPoints * 10) / 10,
          gamesPlayed,
          avgPoints: Math.round(avgPoints * 10) / 10,
        };
      });

      setPlayers(playersWithStats);
      setStatsLoaded(true);
    } catch (err) {
      console.error('Failed to load player stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Filter and sort players
  useEffect(() => {
    let result = [...players];

    // Filter by position
    if (selectedPosition !== 'ALL') {
      result = result.filter(p => p.position === selectedPosition);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.team.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'projected':
        result.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
        break;
      case 'total':
        result.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        break;
      case 'average':
        result.sort((a, b) => (b.avgPoints || 0) - (a.avgPoints || 0));
        break;
      case 'rank':
      default:
        result.sort((a, b) => (a.searchRank || 9999) - (b.searchRank || 9999));
        break;
    }

    setFilteredPlayers(result);
    setDisplayCount(50); // Reset display count on filter change
  }, [players, searchQuery, selectedPosition, sortBy]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handlePositionChange = (position: Position | 'ALL') => {
    setSelectedPosition(position);
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 50);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-text-secondary">Loading NFL players...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">⚠️</span>
        <p className="text-red">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏈</span>
        <h2 className="text-xl font-semibold text-white">Player Database</h2>
        <div className="flex-1 h-px bg-field-border"></div>
        <span className="text-text-muted text-sm">
          {filteredPlayers.length.toLocaleString()} players
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <SearchInput 
          placeholder="Search by name or team..." 
          onSearch={handleSearch}
        />
        <div className="flex flex-wrap gap-4 items-center">
          <PositionFilter 
            selectedPosition={selectedPosition}
            onPositionChange={handlePositionChange}
          />
          
          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input-field py-2 px-3 text-sm"
            >
              <option value="rank">Fantasy Rank</option>
              <option value="name">Name (A-Z)</option>
              <option value="projected">Projected Points</option>
              <option value="total">Total Points (Season)</option>
              <option value="average">Avg Points/Game</option>
            </select>
            {loadingStats && (
              <span className="text-text-muted text-sm flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Loading stats...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-text-secondary">No players found matching your criteria</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlayers.slice(0, displayCount).map((player) => (
              <PlayerCardWithStats 
                key={player.id} 
                player={player} 
                sortBy={sortBy}
                statsLoaded={statsLoaded}
              />
            ))}
          </div>

          {/* Load More */}
          {displayCount < filteredPlayers.length && (
            <div className="text-center pt-4">
              <button onClick={handleLoadMore} className="btn-secondary">
                Load More ({filteredPlayers.length - displayCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Enhanced player card that shows stats based on sort selection
function PlayerCardWithStats({ 
  player, 
  sortBy, 
  statsLoaded 
}: { 
  player: PlayerWithSeasonStats; 
  sortBy: SortOption;
  statsLoaded: boolean;
}) {
  // Determine what stat to show based on sort
  const getStatDisplay = () => {
    if (!statsLoaded && (sortBy === 'projected' || sortBy === 'total' || sortBy === 'average')) {
      return null;
    }
    
    switch (sortBy) {
      case 'projected':
        return player.projectedPoints !== undefined ? (
          <div className="text-right">
            <div className="stat-number text-lg text-gold">{player.projectedPoints}</div>
            <div className="text-xs text-text-muted">Projected</div>
          </div>
        ) : null;
      case 'total':
        return player.totalPoints !== undefined ? (
          <div className="text-right">
            <div className="stat-number text-lg text-turf">{player.totalPoints}</div>
            <div className="text-xs text-text-muted">Total ({player.gamesPlayed} games)</div>
          </div>
        ) : null;
      case 'average':
        return player.avgPoints !== undefined ? (
          <div className="text-right">
            <div className="stat-number text-lg text-cyan">{player.avgPoints}</div>
            <div className="text-xs text-text-muted">Avg/Game</div>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  const statDisplay = getStatDisplay();

  return (
    <div className="relative">
      <PlayerCard player={player} />
      {statDisplay && (
        <div className="absolute top-4 right-4 bg-field-dark/90 rounded-lg px-3 py-2 border border-field-border">
          {statDisplay}
        </div>
      )}
    </div>
  );
}

