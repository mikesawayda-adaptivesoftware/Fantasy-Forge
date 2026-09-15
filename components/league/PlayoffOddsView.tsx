'use client';

import { useMemo } from 'react';
import { SleeperRoster } from '@/types';
import { LeagueData } from '@/lib/hooks/useLeagueData';
import { FantasyData } from '@/lib/hooks/useFantasyData';
import { analyzeRosterLineup } from '@/lib/league';
import { useAsync } from '@/lib/hooks/useAsync';
import { getLeagueMatchups } from '@/lib/sleeper';
import { getScoredWeeks, toWeeklyScores } from '@/lib/power-rankings';
import { simulatePlayoffOdds, sortOdds, toScheduledWeek } from '@/lib/playoff-odds';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import TeamCell from './TeamCell';

/** Only claim certainty when no games remain; simulations can miss long shots */
function formatOdds(pct: number, final: boolean): string {
  if (final) return pct >= 100 ? 'In' : pct <= 0 ? 'Out' : `${pct.toFixed(1)}%`;
  if (pct >= 100) return '>99.9%';
  if (pct <= 0) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

function pctClass(pct: number): string {
  if (pct >= 90) return 'text-turf';
  if (pct >= 50) return 'text-turf-glow';
  if (pct >= 15) return 'text-gold';
  return 'text-red';
}

export default function PlayoffOddsView({ league, data }: { league: LeagueData; data: FantasyData }) {
  const info = league.league;
  const playoffStart = info?.settings.playoff_week_start || 15;
  const playoffTeams = info?.settings.playoff_teams || 6;
  const scored = useMemo(() => (info && league.week ? getScoredWeeks(info, league.week) : []), [info, league.week]);
  const lastScored = scored.length ? scored[scored.length - 1] : (info?.settings.start_week ?? 1) - 1;
  const remainingWeeks = useMemo(() => {
    const weeks: number[] = [];
    for (let w = lastScored + 1; w < playoffStart; w++) weeks.push(w);
    return weeks;
  }, [lastScored, playoffStart]);

  const key = info ? `${info.league_id}:${scored.join(',')}:${remainingWeeks.join(',')}` : null;
  const matchups = useAsync(key, async () => {
    const [done, future] = await Promise.all([
      Promise.all(scored.map(week => getLeagueMatchups(info!.league_id, week).then(m => toWeeklyScores(week, m)))),
      Promise.all(remainingWeeks.map(week => getLeagueMatchups(info!.league_id, week).catch(() => []).then(m => toScheduledWeek(week, m)))),
    ]);
    return { done, future };
  });

  // The dashboard refreshes rosters every 2 minutes; only re-simulate when standings change
  const standingsJson = JSON.stringify(
    league.rosters.map(r => ({ roster_id: r.roster_id, owner_id: r.owner_id, settings: r.settings, players: r.players, starters: r.starters, reserve: r.reserve, taxi: r.taxi }))
  );
  const rosters = useMemo(() => JSON.parse(standingsJson) as SleeperRoster[], [standingsJson]);

  // Projected optimal lineup for each team – the prior before games are scored
  const { playersById, projected } = data;
  const week = league.week;
  const rosterPositions = info?.roster_positions;
  const priorMeans = useMemo(() => {
    if (!week || !rosterPositions) return undefined;
    const means: Record<number, number> = {};
    for (const roster of rosters) {
      means[roster.roster_id] = analyzeRosterLineup({
        rosterPositions,
        roster,
        matchup: null,
        playersById,
        schedule: null,
        week,
        projectionFor: id => projected.get(id) ?? 0,
      }).optimization.optimalTotal;
    }
    return means;
  }, [rosters, week, rosterPositions, playersById, projected]);

  const rows = useMemo(() => {
    if (!matchups.data || rosters.length === 0) return null;
    const odds = simulatePlayoffOdds({
      rosters,
      completed: matchups.data.done,
      remaining: matchups.data.future,
      playoffTeams,
      medianGame: info?.settings.league_average_match === 1,
      priorMeans,
    });
    return sortOdds(odds, rosters);
  }, [matchups.data, rosters, playoffTeams, info, priorMeans]);

  if (matchups.error) return <ErrorState message={matchups.error.message} onRetry={matchups.reload} />;
  if (!rows) return <LoadingState message="Simulating the rest of the season..." />;

  const unpublished = matchups.data?.future.filter(w => w.pairs.length === 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-field-card/30 border border-field-border rounded-xl p-4 text-sm text-text-secondary">
        <p>
          5,000 simulations of {remainingWeeks.length ? `weeks ${remainingWeeks[0]}–${remainingWeeks[remainingWeeks.length - 1]}` : 'the remaining schedule'} using each
          team&apos;s scoring average and volatility (blended with its projected lineup early in the season). Top {playoffTeams} make the playoffs, seeded by record then points
          {info?.settings.league_average_match === 1 ? ', with the weekly median game included' : ''}. Divisions aren&apos;t modeled.
        </p>
        {remainingWeeks.length === 0 && <p className="mt-1 text-gold">The regular season is over – these are the final seeds.</p>}
        {unpublished > 0 && <p className="mt-1 text-text-muted">{unpublished} week(s) have no published matchups, so opponents are randomized.</p>}
      </div>

      <div className="bg-field-card/50 border border-field-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-field-elevated/50 border-b border-field-border text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-3">Team</th>
              <th className="text-center px-3 py-3">Record</th>
              <th className="text-right px-3 py-3 hidden sm:table-cell" title="Average wins at the end of the regular season">Proj. Wins</th>
              <th className="text-left px-3 py-3 w-48">Playoffs</th>
              <th className="text-right px-3 py-3">Bye</th>
              <th className="text-right px-3 py-3 hidden sm:table-cell">#1 Seed</th>
              <th className="text-right px-3 py-3 hidden sm:table-cell">Avg Seed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const roster = league.rosters.find(r => r.roster_id === row.rosterId)!;
              const isUser = row.rosterId === league.userRoster?.roster_id;
              const { wins, losses, ties } = roster.settings;
              return (
                <tr key={row.rosterId} className={`border-b border-field-border/50 ${isUser ? 'bg-turf/10' : ''}`}>
                  <td className="px-3 py-3">
                    <TeamCell owner={league.ownerOf?.(roster) ?? null} rosterId={row.rosterId} isUser={isUser} />
                  </td>
                  <td className="px-3 py-3 text-center stat-number text-white">
                    {wins}-{losses}
                    {ties > 0 && `-${ties}`}
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-right stat-number text-text-secondary">{row.projectedWins.toFixed(1)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-field-dark rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-turf to-turf-glow" style={{ width: `${row.playoffPct}%` }} />
                      </div>
                      <span className={`stat-number w-16 text-right ${pctClass(row.playoffPct)}`}>
                        {formatOdds(row.playoffPct, remainingWeeks.length === 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right stat-number text-text-secondary">{row.byePct.toFixed(1)}%</td>
                  <td className="hidden sm:table-cell px-3 py-3 text-right stat-number text-text-secondary">{row.firstSeedPct.toFixed(1)}%</td>
                  <td className="hidden sm:table-cell px-3 py-3 text-right stat-number text-text-muted">{row.averageSeed?.toFixed(1) ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
