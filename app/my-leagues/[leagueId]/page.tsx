'use client';

import { Suspense, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { useLeagueData } from '@/lib/hooks/useLeagueData';
import { useQueryParams } from '@/lib/hooks/useQueryParam';
import { getUserAvatarUrl } from '@/lib/nfl';
import { leagueHasIdp } from '@/lib/league';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import MatchupView from '@/components/league/MatchupView';
import LineupView from '@/components/league/LineupView';
import RosterView from '@/components/league/RosterView';
import StandingsView from '@/components/league/StandingsView';
import PowerRankingsView from '@/components/league/PowerRankingsView';
import PlayoffOddsView from '@/components/league/PlayoffOddsView';
import TransactionsView from '@/components/league/TransactionsView';

const TABS = [
  { key: 'matchup', label: 'This Week', icon: '⚔️' },
  { key: 'lineup', label: 'Lineup', icon: '🎯' },
  { key: 'roster', label: 'My Roster', icon: '📋' },
  { key: 'standings', label: 'Standings', icon: '🏆' },
  { key: 'power', label: 'Power Rankings', icon: '📈' },
  { key: 'playoffs', label: 'Playoff Odds', icon: '🎲' },
  { key: 'transactions', label: 'Transactions', icon: '📜' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function LeagueDashboard({ leagueId }: { leagueId: string }) {
  // Refresh every 2 minutes so live scores and lineup locks stay current on game days
  const league = useLeagueData(leagueId, { refreshMs: 120_000 });
  const data = useFantasyData({
    scoring: league.league?.scoring_settings,
    includeIdp: leagueHasIdp(league.league?.roster_positions),
    refreshMs: 120_000,
  });
  const [params, setParams] = useQueryParams(['tab'] as const);
  const activeTab: TabKey = TABS.some(t => t.key === params.tab) ? (params.tab as TabKey) : 'matchup';

  if (league.loading || data.loading) return <LoadingState message="Loading your league..." />;
  if (league.error || data.error) {
    return (
      <div className="space-y-4">
        <ErrorState message={(league.error ?? data.error)?.message} onRetry={league.error ? league.retry : data.retry} />
        <div className="text-center">
          <Link href="/my-leagues" className="btn-secondary inline-block">
            ← Back to My Leagues
          </Link>
        </div>
      </div>
    );
  }

  const needsAccount = !league.username;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/my-leagues" className="text-text-secondary hover:text-white transition-colors">
            ← Back
          </Link>
          <div className="w-px h-6 bg-field-border" />
          {league.league?.avatar && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-field-elevated flex-shrink-0">
              <Image src={getUserAvatarUrl(league.league.avatar)} alt={league.league.name} fill className="object-cover" />
            </div>
          )}
          <h2 className="text-xl font-semibold text-white truncate">{league.league?.name}</h2>
        </div>
        <div className="text-text-secondary text-sm">
          Week {league.week} · {league.league?.total_rosters} teams
        </div>
      </div>

      {needsAccount && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 text-sm text-gold">
          <Link href="/my-leagues" className="underline">Connect your Sleeper account</Link> to see your matchup, lineup and roster.
        </div>
      )}

      <div className="flex gap-2 border-b border-field-border pb-2 overflow-x-auto" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setParams({ tab: tab.key === 'matchup' ? null : tab.key })}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key ? 'bg-turf text-black' : 'text-text-secondary hover:text-white hover:bg-field-card'
            }`}
          >
            <span aria-hidden>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'matchup' && <MatchupView league={league} data={data} />}
      {activeTab === 'lineup' && <LineupView league={league} data={data} />}
      {activeTab === 'roster' && <RosterView league={league} data={data} />}
      {activeTab === 'standings' && <StandingsView league={league} />}
      {activeTab === 'power' && <PowerRankingsView league={league} />}
      {activeTab === 'playoffs' && <PlayoffOddsView league={league} />}
      {activeTab === 'transactions' && <TransactionsView league={league} data={data} />}
    </div>
  );
}

export default function LeagueDashboardPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = use(params);
  return (
    <Suspense fallback={<LoadingState message="Loading your league..." />}>
      <LeagueDashboard leagueId={leagueId} />
    </Suspense>
  );
}
