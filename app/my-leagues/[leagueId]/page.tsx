'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  SleeperUser, 
  SleeperLeague, 
  RosterWithPlayers, 
  MatchupDetails, 
  Player,
  Position,
  PlayerWithStats
} from '@/types';
import { 
  getUserByUsername,
  getLeague,
  getUserMatchup,
  getLeagueStandings,
  getUserAvatarUrl,
  getCurrentWeek,
  getCurrentSeason,
  fetchWeeklyProjections,
  fetchWeeklyStats,
  calculateFantasyPoints,
  getHeadshotUrl
} from '@/lib/sleeper';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PlayerCard from '@/components/ui/PlayerCard';

interface PageProps {
  params: Promise<{ leagueId: string }>;
}

export default function LeagueDashboardPage({ params }: PageProps) {
  const { leagueId } = use(params);
  
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [league, setLeague] = useState<SleeperLeague | null>(null);
  const [matchup, setMatchup] = useState<MatchupDetails | null>(null);
  const [standings, setStandings] = useState<RosterWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matchup' | 'roster' | 'standings' | 'advisor'>('matchup');

  useEffect(() => {
    const loadData = async () => {
      // Get username from localStorage
      const storedUsername = localStorage.getItem('sleeper_username');
      if (!storedUsername) {
        setError('Please connect your Sleeper account first');
        setLoading(false);
        return;
      }

      try {
        // Get user info
        const userData = await getUserByUsername(storedUsername);
        if (!userData) {
          setError('Could not find your Sleeper account');
          setLoading(false);
          return;
        }
        setUser(userData);

        // Get league info
        const leagueData = await getLeague(leagueId);
        if (!leagueData) {
          setError('League not found');
          setLoading(false);
          return;
        }
        setLeague(leagueData);

        // Get current matchup
        const matchupData = await getUserMatchup(leagueId, userData.user_id);
        setMatchup(matchupData);

        // Get standings
        const standingsData = await getLeagueStandings(leagueId);
        setStandings(standingsData);
      } catch (err) {
        console.error('Error loading league data:', err);
        setError('Failed to load league data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red/10 border border-red/30 rounded-xl p-4 text-center">
          <p className="text-red">{error}</p>
        </div>
        <Link href="/my-leagues" className="btn-secondary inline-block">
          ← Back to My Leagues
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/my-leagues" className="text-text-secondary hover:text-white transition-colors">
            ← Back
          </Link>
          <div className="w-px h-6 bg-field-border"></div>
          <div className="flex items-center gap-3">
            {league?.avatar && (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-field-elevated">
                <Image
                  src={`https://sleepercdn.com/avatars/${league.avatar}`}
                  alt={league?.name || 'League'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <h2 className="text-xl font-semibold text-white">{league?.name}</h2>
          </div>
        </div>
        <div className="text-text-secondary text-sm">
          Week {getCurrentWeek()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-field-border pb-2 overflow-x-auto">
        {[
          { key: 'matchup', label: 'This Week', icon: '⚔️' },
          { key: 'advisor', label: 'Start/Sit', icon: '🎯' },
          { key: 'roster', label: 'My Roster', icon: '📋' },
          { key: 'standings', label: 'Standings', icon: '🏆' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-turf text-white'
                : 'text-text-secondary hover:text-white hover:bg-field-card'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'matchup' && matchup && (
        <MatchupView matchup={matchup} userId={user?.user_id} />
      )}
      
      {activeTab === 'matchup' && !matchup && (
        <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
          <span className="text-4xl mb-3 block">🏈</span>
          <p className="text-text-secondary">No matchup found for this week</p>
        </div>
      )}

      {activeTab === 'roster' && matchup && (
        <RosterView roster={matchup.userTeam} />
      )}

      {activeTab === 'standings' && (
        <StandingsView standings={standings} userId={user?.user_id} />
      )}

      {activeTab === 'advisor' && matchup && (
        <StartSitAdvisorView roster={matchup.userTeam} />
      )}

      {activeTab === 'advisor' && !matchup && (
        <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
          <span className="text-4xl mb-3 block">🎯</span>
          <p className="text-text-secondary">No roster data available</p>
        </div>
      )}
    </div>
  );
}

// Matchup View Component
function MatchupView({ matchup, userId }: { matchup: MatchupDetails; userId?: string }) {
  // Determine if games have started (actual points > 0)
  const hasActualPoints = matchup.userActual > 0 || matchup.opponentActual > 0;
  
  // Use actual points for comparison if available, otherwise projected
  const userWinning = hasActualPoints 
    ? matchup.userActual > matchup.opponentActual
    : matchup.userProjected > matchup.opponentProjected;
  
  const actualDiff = Math.abs(matchup.userActual - matchup.opponentActual);
  const projDiff = Math.abs(matchup.userProjected - matchup.opponentProjected);
  
  // Calculate if user is beating/missing projection
  const userVsProj = matchup.userActual - matchup.userProjected;
  const oppVsProj = matchup.opponentActual - matchup.opponentProjected;

  return (
    <div className="space-y-6">
      {/* Matchup Overview */}
      <div className="bg-field-card/50 border border-field-border rounded-xl p-6">
        <div className="text-center mb-4">
          <h3 className="text-sm text-text-muted uppercase tracking-wide">Week {matchup.week} Matchup</h3>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          {/* User Team */}
          <div className="flex-1 text-center">
            <div className="relative w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-field-elevated">
              {matchup.userTeam.owner?.avatar ? (
                <Image
                  src={getUserAvatarUrl(matchup.userTeam.owner.avatar)}
                  alt={matchup.userTeam.owner.display_name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full text-2xl">👤</div>
              )}
            </div>
            <h4 className="font-semibold text-white">
              {matchup.userTeam.owner?.metadata?.team_name || matchup.userTeam.owner?.display_name || 'Your Team'}
            </h4>
            
            {/* Actual Points (Primary if games started) */}
            {hasActualPoints ? (
              <>
                <div className={`stat-number text-3xl mt-2 ${userWinning ? 'text-turf' : 'text-red'}`}>
                  {matchup.userActual.toFixed(1)}
                </div>
                <p className="text-text-muted text-sm">Actual</p>
                <div className="mt-2 text-sm">
                  <span className="text-text-muted">Proj: </span>
                  <span className="text-text-secondary">{matchup.userProjected.toFixed(1)}</span>
                  {userVsProj !== 0 && (
                    <span className={`ml-1 ${userVsProj >= 0 ? 'text-turf' : 'text-red'}`}>
                      ({userVsProj >= 0 ? '+' : ''}{userVsProj.toFixed(1)})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={`stat-number text-3xl mt-2 ${userWinning ? 'text-turf' : 'text-red'}`}>
                  {matchup.userProjected.toFixed(1)}
                </div>
                <p className="text-text-muted text-sm">Projected</p>
              </>
            )}
          </div>

          {/* VS */}
          <div className="text-center px-6">
            <div className="text-2xl font-bold text-text-muted">VS</div>
            {hasActualPoints ? (
              <div className={`text-sm mt-2 ${userWinning ? 'text-turf' : 'text-red'}`}>
                {userWinning ? `+${actualDiff.toFixed(1)}` : `-${actualDiff.toFixed(1)}`}
              </div>
            ) : (
              <div className={`text-sm mt-2 ${userWinning ? 'text-turf' : 'text-red'}`}>
                {userWinning ? `+${projDiff.toFixed(1)}` : `-${projDiff.toFixed(1)}`}
              </div>
            )}
          </div>

          {/* Opponent Team */}
          <div className="flex-1 text-center">
            <div className="relative w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden bg-field-elevated">
              {matchup.opponentTeam.owner?.avatar ? (
                <Image
                  src={getUserAvatarUrl(matchup.opponentTeam.owner.avatar)}
                  alt={matchup.opponentTeam.owner.display_name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full text-2xl">👤</div>
              )}
            </div>
            <h4 className="font-semibold text-white">
              {matchup.opponentTeam.owner?.metadata?.team_name || matchup.opponentTeam.owner?.display_name || 'Opponent'}
            </h4>
            
            {/* Actual Points (Primary if games started) */}
            {hasActualPoints ? (
              <>
                <div className={`stat-number text-3xl mt-2 ${!userWinning ? 'text-turf' : 'text-red'}`}>
                  {matchup.opponentActual.toFixed(1)}
                </div>
                <p className="text-text-muted text-sm">Actual</p>
                <div className="mt-2 text-sm">
                  <span className="text-text-muted">Proj: </span>
                  <span className="text-text-secondary">{matchup.opponentProjected.toFixed(1)}</span>
                  {oppVsProj !== 0 && (
                    <span className={`ml-1 ${oppVsProj >= 0 ? 'text-turf' : 'text-red'}`}>
                      ({oppVsProj >= 0 ? '+' : ''}{oppVsProj.toFixed(1)})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={`stat-number text-3xl mt-2 ${!userWinning ? 'text-turf' : 'text-red'}`}>
                  {matchup.opponentProjected.toFixed(1)}
                </div>
                <p className="text-text-muted text-sm">Projected</p>
              </>
            )}
          </div>
        </div>

        {/* Status/Prediction */}
        <div className="mt-6 pt-4 border-t border-field-border text-center">
          {hasActualPoints ? (
            <span className={`text-lg font-semibold ${userWinning ? 'text-turf' : 'text-red'}`}>
              {userWinning ? '🏆 You\'re winning!' : '😬 You\'re behind - rally time!'}
            </span>
          ) : (
            <span className={`text-lg font-semibold ${userWinning ? 'text-turf' : 'text-red'}`}>
              {userWinning ? '🎯 You\'re projected to win!' : '⚠️ Close matchup - check your lineup!'}
            </span>
          )}
        </div>
      </div>

      {/* Starters Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        <StartersList
          title="Your Starters"
          players={matchup.userTeam.starters}
          playerPoints={matchup.userPlayerPoints}
          playerProjections={matchup.playerProjections}
          isUser={true}
        />
        <StartersList
          title="Opponent Starters"
          players={matchup.opponentTeam.starters}
          playerPoints={matchup.opponentPlayerPoints}
          playerProjections={matchup.playerProjections}
          isUser={false}
        />
      </div>
    </div>
  );
}

// Starters List Component
function StartersList({ 
  title, 
  players, 
  playerPoints,
  playerProjections,
  isUser 
}: { 
  title: string; 
  players: Player[];
  playerPoints: Record<string, number>;
  playerProjections: Record<string, number>;
  isUser: boolean;
}) {
  return (
    <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
      <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
        <span>{isUser ? '📋' : '👀'}</span>
        {title}
      </h4>
      <div className="space-y-2">
        {players.map((player, index) => {
          const actual = playerPoints[player.id] || 0;
          const projected = playerProjections[player.id] || 0;
          const hasActual = actual > 0 || Object.keys(playerPoints).length > 0;
          const diff = actual - projected;
          
          return (
            <Link
              key={`${player.id}-${index}`}
              href={`/players/${player.id}`}
              className="flex items-center gap-3 p-2 rounded-lg bg-field-elevated/50 hover:bg-field-elevated transition-colors"
            >
              <span className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                player.position === 'QB' ? 'bg-red/20 text-red' :
                player.position === 'RB' ? 'bg-turf/20 text-turf' :
                player.position === 'WR' ? 'bg-cyan/20 text-cyan' :
                player.position === 'TE' ? 'bg-gold/20 text-gold' :
                'bg-text-muted/20 text-text-muted'
              }`}>
                {player.position}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">{player.name}</p>
                <p className="text-text-muted text-xs">{player.team}</p>
              </div>
              
              {/* Points Display */}
              <div className="text-right flex-shrink-0">
                {hasActual ? (
                  <>
                    <div className={`stat-number text-sm ${
                      diff >= 0 ? 'text-turf' : 'text-red'
                    }`}>
                      {actual.toFixed(1)}
                    </div>
                    <div className="text-text-muted text-xs flex items-center gap-1 justify-end">
                      <span>Proj: {projected.toFixed(1)}</span>
                      {diff !== 0 && (
                        <span className={diff >= 0 ? 'text-turf' : 'text-red'}>
                          ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="stat-number text-sm text-gold">
                      {projected.toFixed(1)}
                    </div>
                    <div className="text-text-muted text-xs">Projected</div>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Roster View Component
function RosterView({ roster }: { roster: RosterWithPlayers }) {
  return (
    <div className="space-y-6">
      {/* Starters */}
      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>⭐</span>
          Starters
          <span className="text-text-muted text-sm font-normal">
            ({roster.projectedPoints} projected pts)
          </span>
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.starters.map((player, index) => (
            <PlayerCard key={`starter-${player.id}-${index}`} player={player} compact />
          ))}
        </div>
      </div>

      {/* Bench */}
      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>🪑</span>
          Bench
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.bench.map((player, index) => (
            <PlayerCard key={`bench-${player.id}-${index}`} player={player} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

// Standings View Component
function StandingsView({ 
  standings, 
  userId 
}: { 
  standings: RosterWithPlayers[];
  userId?: string;
}) {
  return (
    <div className="bg-field-card/50 border border-field-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-field-elevated/50 border-b border-field-border">
            <th className="text-left text-text-muted text-xs uppercase tracking-wide px-4 py-3">Rank</th>
            <th className="text-left text-text-muted text-xs uppercase tracking-wide px-4 py-3">Team</th>
            <th className="text-center text-text-muted text-xs uppercase tracking-wide px-4 py-3">Record</th>
            <th className="text-right text-text-muted text-xs uppercase tracking-wide px-4 py-3">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, index) => {
            const isUser = team.roster.owner_id === userId;
            return (
              <tr 
                key={team.roster.roster_id}
                className={`border-b border-field-border/50 ${
                  isUser ? 'bg-turf/10' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`font-semibold ${
                    index === 0 ? 'text-gold' :
                    index === 1 ? 'text-gray-300' :
                    index === 2 ? 'text-amber-600' :
                    'text-text-muted'
                  }`}>
                    {index + 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-field-elevated">
                      {team.owner?.avatar ? (
                        <Image
                          src={getUserAvatarUrl(team.owner.avatar)}
                          alt={team.owner.display_name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm">👤</div>
                      )}
                    </div>
                    <div>
                      <p className={`font-medium ${isUser ? 'text-turf' : 'text-white'}`}>
                        {team.owner?.metadata?.team_name || team.owner?.display_name || `Team ${team.roster.roster_id}`}
                        {isUser && <span className="ml-2 text-xs">(You)</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="stat-number text-white">
                    {team.roster.settings.wins}-{team.roster.settings.losses}
                    {team.roster.settings.ties > 0 && `-${team.roster.settings.ties}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="stat-number text-text-secondary">
                    {team.roster.settings.fpts.toFixed(1)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Start/Sit Advisor Component - Optimized with batch fetching
function StartSitAdvisorView({ roster }: { roster: RosterWithPlayers }) {
  const [suggestions, setSuggestions] = useState<StartSitSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyzeSuggestions = async () => {
      setLoading(true);
      
      try {
        const season = getCurrentSeason();
        const week = getCurrentWeek();
        
        // Fetch more weeks (6) to ensure we can find last 3 actual games played
        // This handles bye weeks and injuries while still being efficient (7 API calls total)
        const weeksToFetch = [];
        for (let w = week - 1; w >= Math.max(1, week - 6); w--) {
          weeksToFetch.push(fetchWeeklyStats(season, w));
        }
        
        const [projections, ...recentStatsWeeks] = await Promise.all([
          fetchWeeklyProjections(season, week),
          ...weeksToFetch,
        ]);
        
        // Helper to get player stats from pre-fetched data
        // Mimics original getPlayerWithStats logic: find last 3 GAMES PLAYED
        const getPlayerStats = (playerId: string) => {
          const proj = projections[playerId];
          const projectedPoints = proj ? calculateFantasyPoints(proj) : 0;
          
          // Build game log of only games where player actually participated
          const gameLog: number[] = [];
          for (const weekStats of recentStatsWeeks) {
            const playerStats = weekStats[playerId];
            if (playerStats) {
              const points = calculateFantasyPoints(playerStats);
              // Check if player actually played (had attempts/targets)
              const stats = playerStats as Record<string, number>;
              const hasPlayed = points > 0 || 
                (stats.pass_att && stats.pass_att > 0) ||
                (stats.rush_att && stats.rush_att > 0) ||
                (stats.rec_tgt && stats.rec_tgt > 0);
              
              if (hasPlayed) {
                gameLog.push(points);
              }
            }
          }
          
          // Get last 3 games played (like original logic)
          const recentGames = gameLog.slice(0, 3); // Already in reverse order (most recent first)
          const recentAvgPoints = recentGames.length > 0 
            ? recentGames.reduce((sum, pts) => sum + pts, 0) / recentGames.length 
            : 0;
          
          return { projectedPoints, recentAvgPoints };
        };
        
        const newSuggestions: StartSitSuggestion[] = [];
        
        // Group players by position
        const startersByPosition: Record<string, Player[]> = {};
        const benchByPosition: Record<string, Player[]> = {};
        
        for (const player of roster.starters) {
          const pos = player.position;
          if (!startersByPosition[pos]) startersByPosition[pos] = [];
          startersByPosition[pos].push(player);
        }
        
        for (const player of roster.bench) {
          const pos = player.position;
          if (!benchByPosition[pos]) benchByPosition[pos] = [];
          benchByPosition[pos].push(player);
        }
        
        // Check each position for potential upgrades (no additional API calls!)
        for (const position of ['QB', 'RB', 'WR', 'TE']) {
          const starters = startersByPosition[position] || [];
          const benchPlayers = benchByPosition[position] || [];
          
          for (const benchPlayer of benchPlayers) {
            const benchStats = getPlayerStats(benchPlayer.id);
            
            for (const starter of starters) {
              const starterStats = getPlayerStats(starter.id);
              
              const benchProjected = benchStats.projectedPoints;
              const starterProjected = starterStats.projectedPoints;
              const benchRecent = benchStats.recentAvgPoints;
              const starterRecent = starterStats.recentAvgPoints;
              
              // Calculate if bench player is significantly better
              const projDiff = benchProjected - starterProjected;
              const recentDiff = benchRecent - starterRecent;
              
              // Suggest if bench player projected 2+ points higher
              // Or if bench player has been much hotter recently (3+ points better)
              if (projDiff >= 2 || (recentDiff >= 3 && projDiff >= 0)) {
                const confidence = Math.min(
                  95,
                  50 + (projDiff * 10) + (recentDiff * 5)
                );
                
                const reasons: string[] = [];
                if (projDiff > 0) {
                  reasons.push(`${benchPlayer.name} projected ${projDiff.toFixed(1)} pts higher`);
                }
                if (recentDiff > 2) {
                  reasons.push(`${benchPlayer.name} averaging ${recentDiff.toFixed(1)} more pts over last 3 games`);
                }
                // Check if starter has injury status (from Player data)
                if (starter.injuryStatus) {
                  reasons.push(`${starter.name} is ${starter.injuryStatus}`);
                }
                
                newSuggestions.push({
                  type: 'upgrade',
                  position: position as Position,
                  benchPlayer: { ...benchPlayer, projectedPoints: benchProjected, recentAvgPoints: benchRecent } as PlayerWithStats,
                  starter: { ...starter, projectedPoints: starterProjected, recentAvgPoints: starterRecent } as PlayerWithStats,
                  projDiff,
                  recentDiff,
                  confidence: Math.round(confidence),
                  reasons,
                });
              }
            }
          }
        }
        
        // Sort by confidence
        newSuggestions.sort((a, b) => b.confidence - a.confidence);
        setSuggestions(newSuggestions);
      } catch (err) {
        console.error('Error analyzing roster:', err);
      } finally {
        setLoading(false);
      }
    };
    
    analyzeSuggestions();
  }, [roster]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-text-secondary mt-3">Analyzing your roster...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-turf/10 border border-turf/30 rounded-xl p-6 text-center">
        <span className="text-4xl mb-3 block">✅</span>
        <h3 className="text-lg font-semibold text-white mb-2">Your lineup looks good!</h3>
        <p className="text-text-secondary">
          Based on projections and recent performance, we don&apos;t see any obvious upgrades
          from your bench. Your current starters are the best options.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
        <h3 className="font-semibold text-gold flex items-center gap-2">
          <span>💡</span>
          {suggestions.length} Lineup Suggestion{suggestions.length > 1 ? 's' : ''}
        </h3>
        <p className="text-text-secondary text-sm mt-1">
          Based on projections and recent 3-game performance
        </p>
      </div>

      {suggestions.map((suggestion, index) => (
        <div key={index} className="bg-field-card/50 border border-field-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              suggestion.position === 'QB' ? 'bg-red/20 text-red' :
              suggestion.position === 'RB' ? 'bg-turf/20 text-turf' :
              suggestion.position === 'WR' ? 'bg-cyan/20 text-cyan' :
              'bg-gold/20 text-gold'
            }`}>
              {suggestion.position}
            </span>
            <span className="text-turf font-semibold">
              {suggestion.confidence}% confidence
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Bench player to START */}
            <div className="flex-1 bg-turf/10 border border-turf/30 rounded-xl p-3">
              <div className="text-xs text-turf font-semibold mb-2">START ✓</div>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-field-elevated">
                  <Image
                    src={getHeadshotUrl(suggestion.benchPlayer.id, suggestion.benchPlayer.position)}
                    alt={suggestion.benchPlayer.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="font-semibold text-white">{suggestion.benchPlayer.name}</p>
                  <p className="text-text-muted text-xs">{suggestion.benchPlayer.team}</p>
                  <p className="text-turf text-sm stat-number">
                    {suggestion.benchPlayer.projectedPoints?.toFixed(1)} proj
                  </p>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="text-2xl text-text-muted">→</div>

            {/* Starter to SIT */}
            <div className="flex-1 bg-red/10 border border-red/30 rounded-xl p-3">
              <div className="text-xs text-red font-semibold mb-2">SIT ✗</div>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-field-elevated">
                  <Image
                    src={getHeadshotUrl(suggestion.starter.id, suggestion.starter.position)}
                    alt={suggestion.starter.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="font-semibold text-white">{suggestion.starter.name}</p>
                  <p className="text-text-muted text-xs">{suggestion.starter.team}</p>
                  <p className="text-red text-sm stat-number">
                    {suggestion.starter.projectedPoints?.toFixed(1)} proj
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reasons */}
          {suggestion.reasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-field-border">
              <ul className="text-text-secondary text-sm space-y-1">
                {suggestion.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gold">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Type for Start/Sit suggestions
interface StartSitSuggestion {
  type: 'upgrade';
  position: Position;
  benchPlayer: PlayerWithStats;
  starter: PlayerWithStats;
  projDiff: number;
  recentDiff: number;
  confidence: number;
  reasons: string[];
}

