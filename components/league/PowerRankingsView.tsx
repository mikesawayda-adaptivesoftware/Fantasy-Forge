'use client';

import { useEffect, useMemo, useState } from 'react';
import { LeagueData } from '@/lib/hooks/useLeagueData';
import { getLeagueMatchups } from '@/lib/sleeper';
import { computePowerRankings, getScoredWeeks, POWER_WEIGHTS, toWeeklyScores, WeeklyScores } from '@/lib/power-rankings';
import { formatSigned } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import TeamCell from './TeamCell';

function formatRecord(w: number, l: number, t: number) {
  return `${w}-${l}${t > 0 ? `-${t}` : ''}`;
}

export default function PowerRankingsView({ league }: { league: LeagueData }) {
  const leagueInfo = league.league;
  const weeks = useMemo(() => (leagueInfo && league.week ? getScoredWeeks(leagueInfo, league.week) : []), [leagueInfo, league.week]);
  const [loaded, setLoaded] = useState<{ key: string; weeks: WeeklyScores[] } | null>(null);
  const key = `${leagueInfo?.league_id}:${weeks.join(',')}`;

  useEffect(() => {
    if (!leagueInfo || weeks.length === 0) return;
    let cancelled = false;
    Promise.all(weeks.map(week => getLeagueMatchups(leagueInfo.league_id, week).then(m => toWeeklyScores(week, m)).catch(() => null))).then(results => {
      if (!cancelled) setLoaded({ key, weeks: results.filter((r): r is WeeklyScores => r !== null) });
    });
    return () => {
      cancelled = true;
    };
  }, [leagueInfo, weeks, key]);

  const rows = useMemo(
    () => (loaded?.key === key ? computePowerRankings(league.rosters, loaded.weeks) : null),
    [loaded, key, league.rosters]
  );

  if (weeks.length === 0) {
    return (
      <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
        <span className="text-4xl mb-3 block">📈</span>
        <p className="text-text-secondary">Power rankings appear once the first week of games has been scored.</p>
      </div>
    );
  }
  if (!rows) return <LoadingState message="Crunching all-play records..." />;

  const standingsRank = new Map(
    [...rows].sort((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor).map((row, index) => [row.rosterId, index + 1])
  );

  return (
    <div className="space-y-4">
      <div className="bg-field-card/30 border border-field-border rounded-xl p-4 text-sm text-text-secondary">
        <p>
          <span className="text-white font-medium">Power score</span> = {POWER_WEIGHTS.allPlay * 100}% all-play win % (your record if you played every team
          every week) + {POWER_WEIGHTS.pointsFor * 100}% points per game + {POWER_WEIGHTS.recent * 100}% last-3-weeks all-play. <span className="text-white font-medium">Luck</span> is
          actual wins minus all-play expected wins. Through week {weeks[weeks.length - 1]}.
        </p>
      </div>

      <div className="bg-field-card/50 border border-field-border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-field-elevated/50 border-b border-field-border text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-3">Rank</th>
              <th className="text-left px-3 py-3">Team</th>
              <th className="text-left px-3 py-3 w-40">Power</th>
              <th className="text-center px-3 py-3">Record</th>
              <th className="text-center px-3 py-3">All-Play</th>
              <th className="text-right px-3 py-3">Luck</th>
              <th className="text-right px-3 py-3">PPG</th>
              <th className="text-right px-3 py-3" title="Points scored ÷ best possible lineup">Efficiency</th>
              <th className="text-center px-3 py-3">Last 3</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const roster = league.rosters.find(r => r.roster_id === row.rosterId);
              const isUser = row.rosterId === league.userRoster?.roster_id;
              const movement = (standingsRank.get(row.rosterId) ?? row.rank) - row.rank;
              return (
                <tr key={row.rosterId} className={`border-b border-field-border/50 ${isUser ? 'bg-turf/10' : ''}`}>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-white">{row.rank}</span>
                    {movement !== 0 && (
                      <span className={`ml-1 text-xs ${movement > 0 ? 'text-turf' : 'text-red'}`} title="Compared to standings">
                        {movement > 0 ? `▲${movement}` : `▼${-movement}`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <TeamCell owner={league.ownerOf?.(roster) ?? null} rosterId={row.rosterId} isUser={isUser} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-field-dark rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-turf to-turf-glow" style={{ width: `${row.powerScore}%` }} />
                      </div>
                      <span className="stat-number text-white w-10 text-right">{row.powerScore.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center stat-number text-white">{formatRecord(row.wins, row.losses, row.ties)}</td>
                  <td className="px-3 py-3 text-center stat-number text-text-secondary">
                    {formatRecord(row.allPlayWins, row.allPlayLosses, row.allPlayTies)}
                  </td>
                  <td className={`px-3 py-3 text-right stat-number ${row.luckWins > 0.5 ? 'text-gold' : row.luckWins < -0.5 ? 'text-cyan' : 'text-text-muted'}`}>
                    {formatSigned(row.luckWins)}
                  </td>
                  <td className="px-3 py-3 text-right stat-number text-text-secondary">{row.pointsPerGame.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right stat-number text-text-secondary">
                    {row.efficiency !== null ? `${Math.round(row.efficiency * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-3 text-center stat-number text-text-muted">{Math.round(row.recentAllPlayPct * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">
        Luck: <span className="text-gold">gold</span> = winning more than scoring suggests, <span className="text-cyan">cyan</span> = unlucky.
      </p>
    </div>
  );
}
