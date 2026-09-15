'use client';

import { useMemo, useState } from 'react';
import { Position } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import PlayerCard from '@/components/ui/PlayerCard';
import SearchInput from '@/components/ui/SearchInput';
import PositionFilter from '@/components/ui/PositionFilter';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import MatchupBadge from '@/components/ui/MatchupBadge';
import { formatPoints } from '@/lib/utils';

type SortOption = 'rank' | 'name' | 'projected' | 'total' | 'average';

const PAGE_SIZE = 50;

export default function PlayersPage() {
  const data = useFantasyData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('rank');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const { listedPlayers, seasons, projected } = data;

  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = listedPlayers.filter(
      p =>
        (selectedPosition === 'ALL' || p.position === selectedPosition) &&
        (!query || p.name.toLowerCase().includes(query) || p.team.toLowerCase() === query)
    );

    const total = (id: string) => seasons.get(id)?.totalPoints ?? 0;
    const avg = (id: string) => seasons.get(id)?.avgPoints ?? 0;
    const proj = (id: string) => projected.get(id) ?? 0;

    switch (sortBy) {
      case 'name':
        return result.sort((a, b) => a.name.localeCompare(b.name));
      case 'projected':
        return result.sort((a, b) => proj(b.id) - proj(a.id));
      case 'total':
        return result.sort((a, b) => total(b.id) - total(a.id));
      case 'average':
        return result.sort((a, b) => avg(b.id) - avg(a.id));
      default:
        return result.sort((a, b) => (a.searchRank ?? 9999) - (b.searchRank ?? 9999));
    }
  }, [listedPlayers, seasons, projected, searchQuery, selectedPosition, sortBy]);

  // Reset paging whenever the filters change
  const updateFilters = (fn: () => void) => {
    fn();
    setDisplayCount(PAGE_SIZE);
  };

  if (data.loading) return <LoadingState message="Loading NFL players..." />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  const statsSeasonNote =
    data.ctx && data.ctx.statsSeason !== data.ctx.season ? ` · stats from ${data.ctx.statsSeason}` : '';

  return (
    <div className="space-y-6">
      <SectionHeader icon="🏈" title="Player Database">
        <span className="text-text-muted text-sm">{filteredPlayers.length.toLocaleString()} players</span>
      </SectionHeader>

      <p className="text-text-muted text-sm">
        Week {data.week} · {data.scoringLabel} scoring{statsSeasonNote}
      </p>

      <div className="space-y-4">
        <SearchInput placeholder="Search by name or team (e.g. KC)..." onSearch={q => updateFilters(() => setSearchQuery(q))} />
        <div className="flex flex-wrap gap-4 items-center">
          <PositionFilter selectedPosition={selectedPosition} onPositionChange={pos => updateFilters(() => setSelectedPosition(pos))} />
          <label className="flex items-center gap-2">
            <span className="text-text-muted text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={e => updateFilters(() => setSortBy(e.target.value as SortOption))}
              className="input-field py-2 px-3 text-sm w-auto"
            >
              <option value="rank">Fantasy Rank</option>
              <option value="name">Name (A-Z)</option>
              <option value="projected">Projected (Week {data.week})</option>
              <option value="total">Total Points (Season)</option>
              <option value="average">Avg Points/Game</option>
            </select>
          </label>
        </div>
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-text-secondary">No players found matching your criteria</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlayers.slice(0, displayCount).map(player => {
              const season = seasons.get(player.id);
              const stat =
                sortBy === 'total'
                  ? { value: formatPoints(season?.totalPoints), label: `Total (${season?.gamesPlayed ?? 0} G)`, color: 'text-turf' }
                  : sortBy === 'average'
                    ? { value: formatPoints(season?.avgPoints), label: 'Avg/Game', color: 'text-cyan' }
                    : { value: formatPoints(projected.get(player.id)), label: 'Projected', color: 'text-gold' };
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  meta={<MatchupBadge matchup={data.getMatchup(player)} position={player.position} compact />}
                  aside={
                    <div className="text-right flex-shrink-0">
                      <div className={`stat-number text-lg ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-text-muted">{stat.label}</div>
                    </div>
                  }
                />
              );
            })}
          </div>

          {displayCount < filteredPlayers.length && (
            <div className="text-center pt-4">
              <button onClick={() => setDisplayCount(c => c + PAGE_SIZE)} className="btn-secondary">
                Load More ({filteredPlayers.length - displayCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
