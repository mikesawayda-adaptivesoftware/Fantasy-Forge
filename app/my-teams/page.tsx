'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { SleeperLeague, SleeperLeagueUser, SleeperMatchup, SleeperRoster } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { findUserRoster, useUserLeagues } from '@/lib/hooks/useUserLeagues';
import { useAsync } from '@/lib/hooks/useAsync';
import { useHydrated } from '@/lib/hooks/useLocalStorage';
import { getLeagueMatchups, getLeagueRosters, getLeagueUsers, getTeamName } from '@/lib/sleeper';
import { calcPoints } from '@/lib/points';
import { analyzeRosterLineup, getCurrentStarters, leagueHasIdp, resolvePlayer } from '@/lib/league';
import { formatPoints, formatSigned } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import PlayerAvatar from '@/components/ui/PlayerAvatar';
import PositionBadge from '@/components/ui/PositionBadge';
import InjuryBadge from '@/components/ui/InjuryBadge';

interface LeagueBundle {
  league: SleeperLeague;
  rosters: SleeperRoster[];
  users: SleeperLeagueUser[];
  matchups: SleeperMatchup[];
}

type Severity = 'critical' | 'warning' | 'info';

interface ActionItem {
  severity: Severity;
  text: string;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'text-red',
  warning: 'text-gold',
  info: 'text-cyan',
};

const SEVERITY_ICONS: Record<Severity, string> = {
  critical: '⛔',
  warning: '⚠️',
  info: '💡',
};

export default function MyTeamsPage() {
  const hydrated = useHydrated();
  const { username, user, leagues, loading: leaguesLoading, error: leaguesError, retry } = useUserLeagues();
  const anyIdp = leagues.some(l => leagueHasIdp(l.roster_positions));
  const data = useFantasyData({ includeIdp: anyIdp, refreshMs: 120_000 });
  const week = data.ctx?.week ?? null;

  const bundles = useAsync(week && leagues.length ? `${leagues.map(l => l.league_id).join(',')}:${week}` : null, () =>
    Promise.all(
      leagues.map(async (league): Promise<LeagueBundle> => {
        const [rosters, users, matchups] = await Promise.all([
          getLeagueRosters(league.league_id),
          getLeagueUsers(league.league_id),
          getLeagueMatchups(league.league_id, week!).catch(() => []),
        ]);
        return { league, rosters, users, matchups };
      })
    )
  );

  const { playersById, schedule, projections } = data;
  const teams = useMemo(() => {
    if (!bundles.data || !user || !week || !data.ready) return null;
    return bundles.data.flatMap(({ league, rosters, users, matchups }) => {
      const roster = findUserRoster(rosters, user.user_id);
      if (!roster) return [];
      // Each league scores projections with its own settings
      const projectionFor = (id: string) => calcPoints(projections[id], league.scoring_settings);
      const matchup = matchups.find(m => m.roster_id === roster.roster_id) ?? null;
      const analysis = analyzeRosterLineup({
        rosterPositions: league.roster_positions,
        roster,
        matchup,
        playersById,
        schedule,
        week,
        projectionFor,
      });

      const opponentMatchup =
        matchup && matchup.matchup_id !== null ? matchups.find(m => m.matchup_id === matchup.matchup_id && m.roster_id !== roster.roster_id) ?? null : null;
      const opponentRoster = opponentMatchup ? rosters.find(r => r.roster_id === opponentMatchup.roster_id) ?? null : null;
      const opponentProjected = opponentRoster
        ? getCurrentStarters(opponentRoster, opponentMatchup).reduce((sum, id) => sum + (id && id !== '0' ? projectionFor(id) : 0), 0)
        : null;
      const opponentOwner = opponentRoster ? users.find(u => u.user_id === opponentRoster.owner_id) ?? null : null;

      const name = (id: string) => resolvePlayer(id, playersById).name;
      const actions: ActionItem[] = [];
      for (const s of analysis.inactiveStarters) actions.push({ severity: 'critical', text: `${name(s.id)} is starting but won't play (${s.reason})` });
      if (analysis.emptySlots > 0) actions.push({ severity: 'critical', text: `${analysis.emptySlots} empty starting slot${analysis.emptySlots > 1 ? 's' : ''}` });
      for (const s of analysis.questionableStarters) actions.push({ severity: 'warning', text: `${name(s.id)} is ${s.status} – check inactives` });
      if (analysis.optimization.gain >= 0.5) {
        actions.push({
          severity: 'info',
          text: `Start ${analysis.optimization.moves.map(m => name(m.add.id)).join(', ')} for ${formatSigned(analysis.optimization.gain)} projected points`,
        });
      }

      return [
        {
          league,
          roster,
          analysis,
          actions,
          projected: analysis.optimization.currentTotal,
          opponentProjected: opponentProjected !== null ? Math.round(opponentProjected * 10) / 10 : null,
          opponentName: opponentRoster ? getTeamName(opponentOwner, opponentRoster.roster_id) : null,
          actual: matchup?.points ?? 0,
          opponentActual: opponentMatchup?.points ?? 0,
        },
      ];
    });
  }, [bundles.data, user, week, data.ready, playersById, schedule, projections]);

  // Players you roster in more than one league
  const exposure = useMemo(() => {
    if (!teams) return [];
    const counts = new Map<string, string[]>();
    for (const team of teams) {
      for (const id of team.roster.players ?? []) {
        counts.set(id, [...(counts.get(id) ?? []), team.league.name]);
      }
    }
    return [...counts.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([id, names]) => ({ player: resolvePlayer(id, playersById), leagues: names }))
      .sort((a, b) => b.leagues.length - a.leagues.length || (a.player.searchRank ?? 9999) - (b.player.searchRank ?? 9999));
  }, [teams, playersById]);

  if (!hydrated) return <LoadingState />;

  if (!username) {
    return (
      <div className="space-y-6">
        <SectionHeader icon="🗂️" title="My Teams" />
        <div className="bg-field-card/50 border border-field-border rounded-xl p-6 text-center">
          <p className="text-text-secondary mb-4">Connect your Sleeper account to see every team&apos;s lineup issues in one place.</p>
          <Link href="/my-leagues" className="btn-primary inline-block">
            Connect Sleeper Account
          </Link>
        </div>
      </div>
    );
  }

  if (leaguesError) return <ErrorState message={leaguesError} onRetry={retry} />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;
  if (bundles.error) return <ErrorState message={bundles.error.message} onRetry={bundles.reload} />;
  if (leaguesLoading || data.loading || (leagues.length > 0 && !teams)) return <LoadingState message="Checking every lineup..." />;

  const totalIssues = teams?.reduce((sum, t) => sum + t.actions.filter(a => a.severity !== 'info').length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <SectionHeader icon="🗂️" title="My Teams">
        <span className="text-text-muted text-sm">Week {week}</span>
      </SectionHeader>

      {!teams || teams.length === 0 ? (
        <p className="text-text-secondary text-center py-8">No active teams found for @{username}.</p>
      ) : (
        <>
          <div className={`rounded-xl p-4 border ${totalIssues ? 'bg-red/10 border-red/30' : 'bg-turf/10 border-turf/30'}`}>
            <p className={`font-semibold ${totalIssues ? 'text-red' : 'text-turf'}`}>
              {totalIssues
                ? `${totalIssues} lineup issue${totalIssues > 1 ? 's' : ''} across ${teams.length} team${teams.length > 1 ? 's' : ''}`
                : `All ${teams.length} lineups are set`}
            </p>
            <p className="text-sm text-text-secondary">Each league is scored with its own settings. Updates every 2 minutes.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {teams.map(team => {
              const winning = team.opponentProjected === null || team.projected >= team.opponentProjected;
              return (
                <section key={team.league.league_id} className="bg-field-card/50 border border-field-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{team.league.name}</h3>
                      <p className="text-xs text-text-muted">
                        {team.roster.settings.wins}-{team.roster.settings.losses}
                        {team.roster.settings.ties ? `-${team.roster.settings.ties}` : ''}
                        {team.opponentName && ` · vs ${team.opponentName}`}
                      </p>
                    </div>
                    {team.opponentProjected !== null && (
                      <div className="text-right flex-shrink-0">
                        <div className={`stat-number ${winning ? 'text-turf' : 'text-red'}`}>
                          {formatPoints(team.projected)} – {formatPoints(team.opponentProjected)}
                        </div>
                        <div className="text-xs text-text-muted">projected</div>
                      </div>
                    )}
                  </div>

                  {team.actions.length === 0 ? (
                    <p className="text-sm text-turf">✅ Lineup is optimal</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {team.actions.map((action, i) => (
                        <li key={i} className={`flex gap-2 ${SEVERITY_STYLES[action.severity]}`}>
                          <span aria-hidden>{SEVERITY_ICONS[action.severity]}</span>
                          <span>{action.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-3 text-sm">
                    <Link href={`/my-leagues/${team.league.league_id}?tab=lineup`} className="text-cyan hover:text-turf">
                      Fix lineup →
                    </Link>
                    <Link href={`/waivers?league=${team.league.league_id}`} className="text-cyan hover:text-turf">
                      Waivers →
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span aria-hidden>📊</span> Player Exposure
              <span className="text-text-muted text-sm font-normal">(rostered in 2+ leagues)</span>
            </h3>
            {exposure.length === 0 ? (
              <p className="text-sm text-text-muted">No player is on more than one of your teams.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {exposure.slice(0, 30).map(({ player, leagues: names }) => (
                  <li key={player.id} className="flex items-center gap-3 bg-field-card/50 border border-field-border rounded-lg p-2">
                    <PlayerAvatar id={player.id} name={player.name} position={player.position} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/players/${player.id}`} className="text-sm text-white truncate hover:text-turf">
                          {player.name}
                        </Link>
                        <InjuryBadge player={player} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <PositionBadge position={player.position} />
                        <span className="truncate" title={names.join(', ')}>
                          {names.join(', ')}
                        </span>
                      </div>
                    </div>
                    <span className="stat-number text-gold text-sm">×{names.length}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
