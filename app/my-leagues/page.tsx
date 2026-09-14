'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SleeperUser, UserLeague } from '@/types';
import { api } from '@/lib/api';
import { getUserByUsername, getUserLeaguesWithContext } from '@/lib/sleeper';
import { getUserAvatarUrl } from '@/lib/nfl';
import { setSavedUsername, useSavedUsername } from '@/lib/hooks/useSavedUsername';
import { useHydrated } from '@/lib/hooks/useLocalStorage';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SectionHeader from '@/components/ui/SectionHeader';

interface LookupResult {
  username: string;
  user: SleeperUser | null;
  leagues: UserLeague[];
  season: string;
}

async function lookup(username: string): Promise<LookupResult> {
  const [user, state] = await Promise.all([getUserByUsername(username), api.state()]);
  if (!user) return { username, user: null, leagues: [], season: state.league_season };
  const leagues = await getUserLeaguesWithContext(user.user_id, state.league_season);
  return { username, user, leagues, season: state.league_season };
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  in_season: { label: 'In Season', className: 'bg-turf/20 text-turf' },
  complete: { label: 'Complete', className: 'bg-text-muted/20 text-text-muted' },
  drafting: { label: 'Drafting', className: 'bg-gold/20 text-gold' },
  pre_draft: { label: 'Pre-Draft', className: 'bg-cyan/20 text-cyan' },
};

export default function MyLeaguesPage() {
  const hydrated = useHydrated();
  const savedUsername = useSavedUsername();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load leagues for the saved username
  useEffect(() => {
    if (!savedUsername) return;
    let cancelled = false;
    lookup(savedUsername)
      .then(r => {
        if (cancelled) return;
        if (!r.user) {
          setError(`Sleeper user "${savedUsername}" was not found.`);
          setSavedUsername(null);
        } else {
          setResult(r);
          setError(null);
        }
      })
      .catch(() => !cancelled && setError('Failed to load your leagues. Please try again.'));
    return () => {
      cancelled = true;
    };
  }, [savedUsername, reloadKey]);

  const handleConnect = async () => {
    const username = input.trim();
    if (!username) {
      setError('Please enter a username');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const user = await getUserByUsername(username);
      if (!user) {
        setError('User not found. Please check the username and try again.');
        return;
      }
      setSavedUsername(username);
      // Re-run the lookup even if the same username was already saved (e.g. after an error)
      setReloadKey(k => k + 1);
    } catch {
      setError('Failed to reach Sleeper. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchUser = () => {
    setSavedUsername(null);
    setResult(null);
    setInput('');
  };

  const current = result && result.username === savedUsername ? result : null;
  const loadingLeagues = hydrated && !!savedUsername && !current && !error;

  return (
    <div className="space-y-6">
      <SectionHeader icon="🏆" title="My Leagues" />

      {!hydrated || loadingLeagues ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : !current ? (
        <div className="bg-field-card/50 border border-field-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Connect Your Sleeper Account</h3>
          <p className="text-text-secondary mb-4">Enter your Sleeper username to see your leagues and get personalized analysis.</p>

          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={e => {
              e.preventDefault();
              handleConnect();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter your Sleeper username"
              aria-label="Sleeper username"
              autoComplete="username"
              className="input-field flex-1"
            />
            <button type="submit" disabled={connecting} className="btn-primary px-6">
              {connecting ? <LoadingSpinner size="sm" /> : 'Connect'}
            </button>
          </form>

          {error && <p className="mt-3 text-red text-sm">{error}</p>}

          <p className="mt-4 text-text-muted text-xs">
            Your username is stored in this browser and sent only to Sleeper – never to FantasyForge&apos;s server.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-field-card/50 border border-field-border rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative w-14 h-14 rounded-full overflow-hidden bg-field-elevated flex-shrink-0">
                <Image src={getUserAvatarUrl(current.user?.avatar)} alt={current.user?.display_name ?? ''} fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">{current.user?.display_name}</h3>
                <p className="text-text-secondary text-sm">@{current.user?.username}</p>
              </div>
            </div>
            <button onClick={handleSwitchUser} className="btn-secondary text-sm">
              Switch User
            </button>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg" aria-hidden>📋</span>
              <h3 className="font-semibold text-white">Your Leagues ({current.season})</h3>
            </div>

            {current.leagues.length === 0 ? (
              <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
                <span className="text-4xl mb-3 block">🏈</span>
                <p className="text-text-secondary">No leagues found for the {current.season} season</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {current.leagues.map(league => {
                  const badge = STATUS_BADGES[league.status];
                  return (
                    <Link
                      key={league.league_id}
                      href={`/my-leagues/${league.league_id}`}
                      className="bg-field-card/50 border border-field-border rounded-xl p-4 hover:border-turf hover:bg-field-card transition-all hover:shadow-lg hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-field-elevated flex items-center justify-center flex-shrink-0">
                            {league.avatar ? (
                              <Image src={getUserAvatarUrl(league.avatar)} alt={league.name} fill className="object-cover" />
                            ) : (
                              <span className="text-2xl">🏈</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-white group-hover:text-turf transition-colors truncate">{league.name}</h4>
                              {badge && <span className={`px-2 py-0.5 text-xs rounded-full ${badge.className}`}>{badge.label}</span>}
                            </div>
                            <p className="text-text-secondary text-sm">
                              {league.total_rosters} teams • {league.settings.type === 2 ? 'Dynasty' : league.settings.type === 1 ? 'Keeper' : 'Redraft'}
                            </p>
                          </div>
                        </div>

                        {league.userRecord && (
                          <div className="text-right flex-shrink-0">
                            <div className="stat-number text-xl text-white">
                              {league.userRecord.wins}-{league.userRecord.losses}
                              {league.userRecord.ties > 0 && `-${league.userRecord.ties}`}
                            </div>
                            <p className="text-text-muted text-xs">Your Record</p>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-field-card/30 border border-field-border rounded-xl p-4">
        <h4 className="font-medium text-white mb-2 flex items-center gap-2">
          <span aria-hidden>💡</span> What you can do with league integration
        </h4>
        <ul className="text-text-secondary text-sm space-y-1">
          <li>• Follow your weekly matchup with live and projected scores</li>
          <li>• Optimize your lineup across every FLEX and SUPER_FLEX slot</li>
          <li>• See standings and power rankings with all-play records and luck</li>
          <li>• Find the best free agents and trending pickups on the waiver wire</li>
          <li>• Everything is scored with your league&apos;s exact settings</li>
        </ul>
      </div>
    </div>
  );
}
