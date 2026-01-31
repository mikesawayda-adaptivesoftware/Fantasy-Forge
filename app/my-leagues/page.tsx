'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SleeperUser, UserLeague } from '@/types';
import { getUserByUsername, getUserLeaguesWithContext, getUserAvatarUrl, getCurrentSeason } from '@/lib/sleeper';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function MyLeaguesPage() {
  const [username, setUsername] = useState('');
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved username from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sleeper_username');
    if (stored) {
      setSavedUsername(stored);
      setUsername(stored);
      handleLookup(stored);
    }
  }, []);

  const handleLookup = async (lookupUsername?: string) => {
    const targetUsername = lookupUsername || username;
    if (!targetUsername.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user info
      const userData = await getUserByUsername(targetUsername.trim());
      if (!userData) {
        setError('User not found. Please check the username and try again.');
        setUser(null);
        setLeagues([]);
        return;
      }

      setUser(userData);
      
      // Save username to localStorage
      localStorage.setItem('sleeper_username', targetUsername.trim());
      setSavedUsername(targetUsername.trim());

      // Get user's leagues
      const userLeagues = await getUserLeaguesWithContext(userData.user_id);
      setLeagues(userLeagues);
    } catch (err) {
      console.error('Error looking up user:', err);
      setError('Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearUser = () => {
    localStorage.removeItem('sleeper_username');
    setSavedUsername(null);
    setUser(null);
    setLeagues([]);
    setUsername('');
  };

  const getLeagueStatusBadge = (status: string) => {
    switch (status) {
      case 'in_season':
        return <span className="px-2 py-0.5 bg-turf/20 text-turf text-xs rounded-full">In Season</span>;
      case 'complete':
        return <span className="px-2 py-0.5 bg-text-muted/20 text-text-muted text-xs rounded-full">Complete</span>;
      case 'drafting':
        return <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs rounded-full">Drafting</span>;
      case 'pre_draft':
        return <span className="px-2 py-0.5 bg-cyan/20 text-cyan text-xs rounded-full">Pre-Draft</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏆</span>
        <h2 className="text-xl font-semibold text-white">My Leagues</h2>
        <div className="flex-1 h-px bg-field-border"></div>
      </div>

      {/* User Lookup Section */}
      {!user ? (
        <div className="bg-field-card/50 border border-field-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Sleeper Account</h3>
          <p className="text-text-secondary mb-4">
            Enter your Sleeper username to see your leagues and get personalized analysis.
          </p>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="Enter your Sleeper username"
              className="input-field flex-1"
            />
            <button
              onClick={() => handleLookup()}
              disabled={loading}
              className="btn-primary px-6"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Connect'}
            </button>
          </div>
          
          {error && (
            <p className="mt-3 text-red text-sm">{error}</p>
          )}
          
          <p className="mt-4 text-text-muted text-xs">
            Your username is saved locally and never sent to our servers.
          </p>
        </div>
      ) : (
        <>
          {/* User Info Card */}
          <div className="bg-field-card/50 border border-field-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-full overflow-hidden bg-field-elevated">
                <Image
                  src={getUserAvatarUrl(user.avatar)}
                  alt={user.display_name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div>
                <h3 className="font-semibold text-white">{user.display_name}</h3>
                <p className="text-text-secondary text-sm">@{user.username}</p>
              </div>
            </div>
            <button
              onClick={handleClearUser}
              className="btn-secondary text-sm"
            >
              Switch User
            </button>
          </div>

          {/* Leagues Grid */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg">📋</span>
              <h3 className="font-semibold text-white">Your Leagues ({getCurrentSeason()})</h3>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : leagues.length === 0 ? (
              <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
                <span className="text-4xl mb-3 block">🏈</span>
                <p className="text-text-secondary">No leagues found for this season</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {leagues.map((league) => (
                  <Link
                    key={league.league_id}
                    href={`/my-leagues/${league.league_id}`}
                    className="bg-field-card/50 border border-field-border rounded-xl p-4 
                              hover:border-turf hover:bg-field-card transition-all
                              hover:shadow-lg hover:-translate-y-0.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* League Avatar */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-field-elevated flex items-center justify-center">
                          {league.avatar ? (
                            <Image
                              src={`https://sleepercdn.com/avatars/${league.avatar}`}
                              alt={league.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-2xl">🏈</span>
                          )}
                        </div>
                        
                        {/* League Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white group-hover:text-turf transition-colors">
                              {league.name}
                            </h4>
                            {getLeagueStatusBadge(league.status)}
                          </div>
                          <p className="text-text-secondary text-sm">
                            {league.total_rosters} teams • {league.settings.type === 2 ? 'Dynasty' : 'Redraft'}
                          </p>
                        </div>
                      </div>

                      {/* User's Record */}
                      {league.userRecord && (
                        <div className="text-right">
                          <div className="stat-number text-xl text-white">
                            {league.userRecord.wins}-{league.userRecord.losses}
                            {league.userRecord.ties > 0 && `-${league.userRecord.ties}`}
                          </div>
                          <p className="text-text-muted text-xs">Your Record</p>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Info Section */}
      <div className="bg-field-card/30 border border-field-border rounded-xl p-4">
        <h4 className="font-medium text-white mb-2 flex items-center gap-2">
          <span>💡</span> What you can do with league integration
        </h4>
        <ul className="text-text-secondary text-sm space-y-1">
          <li>• View your roster and projected points</li>
          <li>• See your weekly matchup analysis</li>
          <li>• Get personalized Start/Sit recommendations</li>
          <li>• Analyze trades based on your team&apos;s needs</li>
          <li>• Track league standings</li>
        </ul>
      </div>
    </div>
  );
}

