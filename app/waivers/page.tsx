'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Player, 
  Position, 
  PlayerStats,
  SleeperUser,
  SleeperLeague,
  RosterWithPlayers
} from '@/types';
import { 
  getUserByUsername,
  getUserLeagues,
  getLeagueRosters,
  getLeagueUsers,
  getRosterWithPlayers,
  getFantasyPlayers,
  getCurrentSeason,
  getCurrentWeek,
  fetchWeeklyProjections,
  fetchWeeklyStats,
  calculateFantasyPoints,
  getTeamByeWeek,
  hasUpcomingBye,
  isByePassed,
  getHeadshotUrl
} from '@/lib/sleeper';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PositionFilter from '@/components/ui/PositionFilter';

interface FreeAgent extends Player {
  projectedPoints?: number;
  recentAvgPoints?: number;
}

interface UpgradeSuggestion {
  freeAgent: FreeAgent;
  dropCandidate: Player & { projectedPoints?: number };
  projectedGain: number;
  reason: string;
  suggestionType: 'same-position' | 'roster-optimization' | 'bye-week-coverage';
}

export default function WaiversPage() {
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [userRoster, setUserRoster] = useState<RosterWithPlayers | null>(null);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);
  const [upgrades, setUpgrades] = useState<UpgradeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFreeAgents, setLoadingFreeAgents] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  // Load user and leagues on mount
  useEffect(() => {
    const loadUserData = async () => {
      const storedUsername = localStorage.getItem('sleeper_username');
      if (!storedUsername) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getUserByUsername(storedUsername);
        if (!userData) {
          setLoading(false);
          return;
        }
        setUser(userData);

        const userLeagues = await getUserLeagues(userData.user_id);
        // Filter to in-season leagues only
        const activeLeagues = userLeagues.filter(l => l.status === 'in_season');
        setLeagues(activeLeagues);

        // Auto-select first league if only one
        if (activeLeagues.length === 1) {
          setSelectedLeagueId(activeLeagues[0].league_id);
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setError('Failed to load your leagues');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Load roster and free agents when league is selected
  useEffect(() => {
    if (!selectedLeagueId || !user) return;

    const loadLeagueData = async () => {
      setLoadingFreeAgents(true);
      setError(null);

      try {
        const season = getCurrentSeason();
        const week = getCurrentWeek();

        // Fetch everything in parallel - only 5 API calls total!
        const [rosters, leagueUsers, allPlayers, projections, recentStats] = await Promise.all([
          getLeagueRosters(selectedLeagueId),
          getLeagueUsers(selectedLeagueId),
          getFantasyPlayers(),
          fetchWeeklyProjections(season, week),
          // Get last 3 weeks of stats for recent average
          Promise.all([
            fetchWeeklyStats(season, Math.max(1, week - 1)),
            fetchWeeklyStats(season, Math.max(1, week - 2)),
            fetchWeeklyStats(season, Math.max(1, week - 3)),
          ]),
        ]);

        // Find user's roster
        const userRosterData = rosters.find(r => r.owner_id === user.user_id);
        if (!userRosterData) {
          setError('Could not find your roster in this league');
          setLoadingFreeAgents(false);
          return;
        }

        // Get full roster details
        const fullRoster = await getRosterWithPlayers(userRosterData, leagueUsers);
        setUserRoster(fullRoster);

        // Collect all rostered player IDs across all teams
        const rosteredPlayerIds = new Set<string>();
        rosters.forEach(roster => {
          (roster.players || []).forEach(playerId => {
            rosteredPlayerIds.add(playerId);
          });
        });

        // Calculate recent average from the 3 weeks of stats
        const calculateRecentAvg = (playerId: string): number => {
          let totalPoints = 0;
          let gamesPlayed = 0;
          
          for (const weekStats of recentStats) {
            const playerStats = weekStats[playerId];
            if (playerStats) {
              const points = calculateFantasyPoints(playerStats);
              if (points > 0) {
                totalPoints += points;
                gamesPlayed++;
              }
            }
          }
          
          return gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;
        };

        // Find free agents and enrich with projections (no additional API calls!)
        const availablePlayers = allPlayers.filter(p => !rosteredPlayerIds.has(p.id));
        
        // Separate defenses and skill players (defenses get filtered out by slice otherwise)
        const availableDefenses = availablePlayers.filter(p => p.position === 'DEF');
        const availableSkillPlayers = availablePlayers.filter(p => p.position !== 'DEF');
        
        // Enrich skill players with projections
        const skillPlayerData: FreeAgent[] = availableSkillPlayers
          .slice(0, 200) // Take top 200 skill players
          .map(player => {
            const playerProj = projections[player.id];
            const projectedPoints = playerProj ? calculateFantasyPoints(playerProj) : 0;
            const recentAvgPoints = calculateRecentAvg(player.id);
            
            return {
              ...player,
              projectedPoints,
              recentAvgPoints,
            };
          })
          .filter(p => (p.projectedPoints || 0) > 0 || (p.recentAvgPoints || 0) > 0);
        
        // Enrich defenses with projections (defenses always shown)
        const defenseData: FreeAgent[] = availableDefenses.map(player => {
          const playerProj = projections[player.id];
          const projectedPoints = playerProj ? calculateFantasyPoints(playerProj) : 0;
          const recentAvgPoints = calculateRecentAvg(player.id);
          
          return {
            ...player,
            projectedPoints,
            recentAvgPoints,
          };
        });
        
        // Combine and sort by projected points
        const freeAgentData: FreeAgent[] = [...skillPlayerData, ...defenseData]
          .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));

        setFreeAgents(freeAgentData);

        // Find upgrade suggestions using the same data
        findUpgradesOptimized(freeAgentData, fullRoster, projections, recentStats);

      } catch (err) {
        console.error('Error loading league data:', err);
        setError('Failed to load waiver wire data');
      } finally {
        setLoadingFreeAgents(false);
      }
    };

    loadLeagueData();
  }, [selectedLeagueId, user]);

  // Smart upgrade finder - considers roster composition, not just same-position swaps
  const findUpgradesOptimized = (
    freeAgents: FreeAgent[], 
    roster: RosterWithPlayers,
    projections: Record<string, PlayerStats['stats']>,
    recentStats: Record<string, PlayerStats['stats']>[]
  ) => {
    const suggestions: UpgradeSuggestion[] = [];

    // Calculate stats for any player using pre-fetched data
    const getPlayerStats = (playerId: string) => {
      const proj = projections[playerId];
      const projectedPoints = proj ? calculateFantasyPoints(proj) : 0;
      
      let totalPoints = 0;
      let gamesPlayed = 0;
      for (const weekStats of recentStats) {
        const playerStats = weekStats[playerId];
        if (playerStats) {
          const points = calculateFantasyPoints(playerStats);
          if (points > 0) {
            totalPoints += points;
            gamesPlayed++;
          }
        }
      }
      const recentAvgPoints = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;
      
      return { projectedPoints, recentAvgPoints };
    };

    // Typical roster needs (starters + 1 backup)
    // Most leagues: 1 QB, 2 RB, 2 WR, 1 TE, 1-2 FLEX, 1 K, 1 DEF
    const idealRosterSize: Record<string, number> = {
      'QB': 2,  // 1 starter + 1 backup
      'RB': 4,  // 2 starters + flex + 1 backup  
      'WR': 4,  // 2 starters + flex + 1 backup
      'TE': 2,  // 1 starter + 1 backup
      'K': 1,   // Just 1 kicker
      'DEF': 1, // Just 1 defense
    };

    // Count players by position (starters + bench)
    const allPlayers = [...roster.starters, ...roster.bench];
    const positionCounts: Record<string, number> = {};
    const playersByPosition: Record<string, (Player & { projectedPoints?: number; recentAvgPoints?: number })[]> = {};
    
    for (const player of allPlayers) {
      const pos = player.position;
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      if (!playersByPosition[pos]) playersByPosition[pos] = [];
      
      const stats = getPlayerStats(player.id);
      playersByPosition[pos].push({
        ...player,
        projectedPoints: stats.projectedPoints,
        recentAvgPoints: stats.recentAvgPoints,
      });
    }

    // Sort players at each position by projected points (worst first)
    for (const pos in playersByPosition) {
      playersByPosition[pos].sort((a, b) => (a.projectedPoints || 0) - (b.projectedPoints || 0));
    }

    // Find "excess" players - positions where you have more than ideal
    const excessPlayers: (Player & { projectedPoints?: number; excessReason: string })[] = [];
    
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]) {
      const count = positionCounts[pos] || 0;
      const ideal = idealRosterSize[pos] || 1;
      const excess = count - ideal;
      
      if (excess > 0 && playersByPosition[pos]) {
        // Take the worst players at this position as drop candidates
        const worstPlayers = playersByPosition[pos].slice(0, excess);
        for (const player of worstPlayers) {
          excessPlayers.push({
            ...player,
            excessReason: `${pos}${playersByPosition[pos].indexOf(player) + 1} of ${count} (only need ${ideal})`,
          });
        }
      }
    }

    // Also add bench players who are just bad (low projected) regardless of position count
    for (const player of roster.bench) {
      const stats = getPlayerStats(player.id);
      if ((stats.projectedPoints || 0) < 5) {
        const alreadyAdded = excessPlayers.some(p => p.id === player.id);
        if (!alreadyAdded) {
          excessPlayers.push({
            ...player,
            projectedPoints: stats.projectedPoints,
            excessReason: `Low projection (${stats.projectedPoints?.toFixed(1)} pts)`,
          });
        }
      }
    }

    // Sort excess players by projected points (worst first = best drop candidates)
    excessPlayers.sort((a, b) => (a.projectedPoints || 0) - (b.projectedPoints || 0));

    // Identify positions where you're thin (need more depth)
    const thinPositions = new Set<string>();
    // Identify positions where you're full (don't need more)
    const fullPositions = new Set<string>();
    
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]) {
      const count = positionCounts[pos] || 0;
      const ideal = idealRosterSize[pos] || 1;
      if (count < ideal) {
        thinPositions.add(pos);
      } else if (count >= ideal) {
        fullPositions.add(pos);
      }
    }

    // =============================================
    // BYE WEEK ANALYSIS
    // =============================================
    const currentWeek = getCurrentWeek();
    
    // Find positions with upcoming bye week problems
    const byeWeekNeeds: { position: Position; byeWeek: number; startersOnBye: Player[] }[] = [];
    
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]) {
      const playersAtPos = playersByPosition[pos] || [];
      const starters = roster.starters.filter(p => p.position === pos);
      const bench = roster.bench.filter(p => p.position === pos);
      
      // Check each starter for upcoming byes (within 2 weeks)
      for (const starter of starters) {
        const byeInfo = hasUpcomingBye(starter.team, 2);
        
        if (byeInfo.hasBye && byeInfo.byeWeek) {
          // Check if we have a good bench replacement for this bye
          const benchBackups = bench.filter(b => {
            // Backup must NOT also be on bye that week
            const backupBye = getTeamByeWeek(b.team);
            return backupBye !== byeInfo.byeWeek;
          });
          
          // Get projected points for backups
          const backupsWithProj = benchBackups.map(b => ({
            ...b,
            proj: getPlayerStats(b.id).projectedPoints
          }));
          
          const bestBackup = backupsWithProj.sort((a, b) => b.proj - a.proj)[0];
          
          // If no good backup (none or best is < 8 points), we need bye coverage
          if (!bestBackup || bestBackup.proj < 8) {
            byeWeekNeeds.push({
              position: pos as Position,
              byeWeek: byeInfo.byeWeek,
              startersOnBye: [starter],
            });
          }
        }
      }
    }

    // Generate bye week coverage suggestions
    for (const need of byeWeekNeeds) {
      // Find FAs at this position who are NOT on bye that week
      const eligibleFAs = freeAgents.filter(fa => {
        if (fa.position !== need.position) return false;
        const faBye = getTeamByeWeek(fa.team);
        return faBye !== need.byeWeek; // FA must not be on bye same week
      });

      for (const fa of eligibleFAs.slice(0, 3)) {
        const faProj = fa.projectedPoints || 0;
        if (faProj < 6) continue; // Must be a viable starter
        
        // Find a drop candidate (prefer excess positions or low performers)
        const dropCandidate = excessPlayers[0];
        if (!dropCandidate) continue;
        
        const projGain = faProj - (dropCandidate.projectedPoints || 0);
        const starterNames = need.startersOnBye.map(s => s.name).join(', ');
        
        suggestions.push({
          freeAgent: fa,
          dropCandidate,
          projectedGain: projGain,
          reason: `🗓️ Week ${need.byeWeek} bye coverage: ${starterNames} on bye. ${fa.name} can fill in.`,
          suggestionType: 'bye-week-coverage',
        });
      }
    }

    // =============================================
    // STANDARD UPGRADE SUGGESTIONS
    // =============================================
    for (const fa of freeAgents.slice(0, 30)) {
      const faProj = fa.projectedPoints || 0;
      const isFAThinPosition = thinPositions.has(fa.position);
      
      // Skip if FA's bye hasn't passed and we're suggesting for depth
      // (we want players whose bye is done for reliability)
      const faByePassed = isByePassed(fa.team);
      
      for (const dropCandidate of excessPlayers) {
        const dropProj = dropCandidate.projectedPoints || 0;
        const projGain = faProj - dropProj;
        const isSamePosition = fa.position === dropCandidate.position;

        let shouldSuggest = false;
        let reason = '';

        if (isSamePosition) {
          // Same position: suggest if FA is significantly better
          if (projGain >= 2) {
            shouldSuggest = true;
            reason = `${fa.name} projected ${projGain.toFixed(1)} pts higher than ${dropCandidate.name}`;
            // Bonus info if FA's bye has passed
            if (faByePassed) {
              reason += ` (bye week done ✓)`;
            }
          }
        } else {
          // Cross-position: ONLY suggest if:
          // 1. FA fills a thin position (you NEED more at that position)
          // 2. AND FA is projected reasonably well (not just any player)
          // 3. AND you're dropping from an excess position
          
          if (isFAThinPosition && faProj >= 8) {
            // You need this position, FA is decent
            shouldSuggest = true;
            reason = `Add ${fa.position} depth (you only have ${positionCounts[fa.position] || 0}). Drop ${dropCandidate.name} (${dropCandidate.excessReason})`;
          }
          // Don't suggest adding more of a position you're already full on
        }

        if (shouldSuggest) {
          suggestions.push({
            freeAgent: fa,
            dropCandidate,
            projectedGain: projGain,
            reason,
            suggestionType: isSamePosition ? 'same-position' : 'roster-optimization',
          });
        }
      }
    }

    // Sort by projected gain and dedupe
    suggestions.sort((a, b) => b.projectedGain - a.projectedGain);
    
    // Keep only unique combinations (best suggestion per FA, and don't suggest same drop twice)
    const seenFAs = new Set<string>();
    const seenDrops = new Set<string>();
    const uniqueSuggestions = suggestions.filter(s => {
      if (seenFAs.has(s.freeAgent.id)) return false;
      if (seenDrops.has(s.dropCandidate.id)) return false;
      seenFAs.add(s.freeAgent.id);
      seenDrops.add(s.dropCandidate.id);
      return true;
    });

    setUpgrades(uniqueSuggestions.slice(0, 10));
  };

  const filteredFreeAgents = selectedPosition === 'ALL' 
    ? freeAgents 
    : freeAgents.filter(p => p.position === selectedPosition);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h2 className="text-xl font-semibold text-white">Waiver Wire</h2>
          <div className="flex-1 h-px bg-field-border"></div>
        </div>

        <div className="bg-field-card/50 border border-field-border rounded-xl p-6 text-center">
          <span className="text-4xl mb-4 block">🔗</span>
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Account</h3>
          <p className="text-text-secondary mb-4">
            Connect your Sleeper account to see available players and get waiver suggestions.
          </p>
          <Link href="/my-leagues" className="btn-primary inline-block">
            Connect Sleeper Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">📋</span>
        <h2 className="text-xl font-semibold text-white">Waiver Wire</h2>
        <div className="flex-1 h-px bg-field-border"></div>
      </div>

      {/* League Selector */}
      {leagues.length > 1 && (
        <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
          <label className="block text-text-muted text-sm mb-2">Select League</label>
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => setSelectedLeagueId(e.target.value)}
            className="input-field w-full"
          >
            <option value="">Choose a league...</option>
            {leagues.map(league => (
              <option key={league.league_id} value={league.league_id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {leagues.length === 0 && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 text-center">
          <p className="text-gold">No active leagues found for {getCurrentSeason()} season.</p>
        </div>
      )}

      {error && (
        <div className="bg-red/10 border border-red/30 rounded-xl p-4 text-center">
          <p className="text-red">{error}</p>
        </div>
      )}

      {loadingFreeAgents && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="text-text-secondary mt-3">Analyzing waiver wire...</p>
          </div>
        </div>
      )}

      {selectedLeagueId && !loadingFreeAgents && (
        <>
          {/* Upgrade Suggestions */}
          {upgrades.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span>🚀</span>
                Suggested Pickups
              </h3>
              
              <div className="grid gap-3">
                {upgrades.map((upgrade, index) => (
                  <div 
                    key={`${upgrade.freeAgent.id}-${upgrade.dropCandidate.id}`}
                    className="bg-field-card/50 border border-field-border rounded-xl p-4"
                  >
                    {/* Suggestion Type Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        upgrade.suggestionType === 'bye-week-coverage'
                          ? 'bg-gold/20 text-gold'
                          : upgrade.suggestionType === 'roster-optimization' 
                          ? 'bg-cyan/20 text-cyan' 
                          : 'bg-turf/20 text-turf'
                      }`}>
                        {upgrade.suggestionType === 'bye-week-coverage'
                          ? '🗓️ Bye Week Coverage'
                          : upgrade.suggestionType === 'roster-optimization' 
                          ? '🧠 Roster Optimization' 
                          : '⬆️ Direct Upgrade'}
                      </span>
                      <span className="text-gold stat-number text-sm">
                        +{upgrade.projectedGain.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Add Player */}
                      <div className="flex-1 bg-turf/10 border border-turf/30 rounded-lg p-3">
                        <div className="text-xs text-turf font-semibold mb-2">ADD ✓</div>
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-field-elevated flex-shrink-0">
                            <Image
                              src={getHeadshotUrl(upgrade.freeAgent.id, upgrade.freeAgent.position)}
                              alt={upgrade.freeAgent.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{upgrade.freeAgent.name}</p>
                            <p className="text-text-muted text-xs">{upgrade.freeAgent.position} • {upgrade.freeAgent.team}</p>
                          </div>
                          <div className="text-right">
                            <div className="stat-number text-turf">{upgrade.freeAgent.projectedPoints?.toFixed(1) || '—'}</div>
                            <div className="text-text-muted text-xs">Projected</div>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="text-xl text-text-muted">↔</div>

                      {/* Drop Player */}
                      <div className="flex-1 bg-red/10 border border-red/30 rounded-lg p-3">
                        <div className="text-xs text-red font-semibold mb-2">DROP ✗</div>
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-field-elevated flex-shrink-0">
                            <Image
                              src={getHeadshotUrl(upgrade.dropCandidate.id, upgrade.dropCandidate.position)}
                              alt={upgrade.dropCandidate.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{upgrade.dropCandidate.name}</p>
                            <p className="text-text-muted text-xs">{upgrade.dropCandidate.position} • {upgrade.dropCandidate.team}</p>
                          </div>
                          <div className="text-right">
                            <div className="stat-number text-red">{upgrade.dropCandidate.projectedPoints?.toFixed(1) || '—'}</div>
                            <div className="text-text-muted text-xs">Projected</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="mt-3 pt-3 border-t border-field-border">
                      <p className="text-text-secondary text-sm">💡 {upgrade.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free Agents List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span>📋</span>
                Available Players
                <span className="text-text-muted text-sm font-normal">
                  ({filteredFreeAgents.length})
                </span>
              </h3>
            </div>

            <PositionFilter
              selectedPosition={selectedPosition}
              onPositionChange={setSelectedPosition}
            />

            <div className="bg-field-card/50 border border-field-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-field-elevated/50 border-b border-field-border">
                    <th className="text-left text-text-muted text-xs uppercase tracking-wide px-4 py-3">Player</th>
                    <th className="text-center text-text-muted text-xs uppercase tracking-wide px-4 py-3">Pos</th>
                    <th className="text-right text-text-muted text-xs uppercase tracking-wide px-4 py-3">Projected</th>
                    <th className="text-right text-text-muted text-xs uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Recent Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFreeAgents.slice(0, 50).map((player) => (
                    <tr 
                      key={player.id}
                      className="border-b border-field-border/50 hover:bg-field-elevated/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/players/${player.id}`} className="flex items-center gap-3 group">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-field-elevated flex-shrink-0">
                            <Image
                              src={getHeadshotUrl(player.id, player.position)}
                              alt={player.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div>
                            <p className="font-medium text-white group-hover:text-turf transition-colors">{player.name}</p>
                            <p className="text-text-muted text-xs">{player.team}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          player.position === 'QB' ? 'bg-red/20 text-red' :
                          player.position === 'RB' ? 'bg-turf/20 text-turf' :
                          player.position === 'WR' ? 'bg-cyan/20 text-cyan' :
                          player.position === 'TE' ? 'bg-gold/20 text-gold' :
                          'bg-text-muted/20 text-text-muted'
                        }`}>
                          {player.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="stat-number text-gold">
                          {player.projectedPoints?.toFixed(1) || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="stat-number text-cyan">
                          {player.recentAvgPoints?.toFixed(1) || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

