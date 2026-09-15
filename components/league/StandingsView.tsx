'use client';

import { LeagueData } from '@/lib/hooks/useLeagueData';
import { compareStandings, rosterPoints } from '@/lib/power-rankings';
import TeamCell from './TeamCell';

const RANK_COLORS = ['text-gold', 'text-gray-300', 'text-amber-600'];

export default function StandingsView({ league }: { league: LeagueData }) {
  const standings = [...league.rosters].sort(compareStandings);
  const playoffTeams = league.league?.settings.playoff_teams;

  return (
    <div className="bg-field-card/50 border border-field-border rounded-xl overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr className="bg-field-elevated/50 border-b border-field-border text-text-muted text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Rank</th>
            <th className="text-left px-4 py-3">Team</th>
            <th className="text-center px-4 py-3">Record</th>
            <th className="text-right px-4 py-3">PF</th>
            <th className="text-right px-4 py-3">PA</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((roster, index) => {
            const isUser = roster.roster_id === league.userRoster?.roster_id;
            const { wins, losses, ties } = roster.settings;
            return (
              <tr
                key={roster.roster_id}
                className={`border-b border-field-border/50 ${isUser ? 'bg-turf/10' : ''} ${playoffTeams && index === playoffTeams - 1 ? 'border-b-2 border-b-turf/40' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className={`font-semibold ${RANK_COLORS[index] ?? 'text-text-muted'}`}>{index + 1}</span>
                </td>
                <td className="px-4 py-3">
                  <TeamCell owner={league.ownerOf?.(roster) ?? null} rosterId={roster.roster_id} isUser={isUser} />
                </td>
                <td className="px-4 py-3 text-center stat-number text-white">
                  {wins}-{losses}
                  {ties > 0 && `-${ties}`}
                </td>
                <td className="px-4 py-3 text-right stat-number text-text-secondary">
                  {rosterPoints(roster.settings.fpts, roster.settings.fpts_decimal).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right stat-number text-text-muted">
                  {rosterPoints(roster.settings.fpts_against, roster.settings.fpts_against_decimal).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {playoffTeams ? <p className="text-xs text-text-muted px-4 py-2">Line marks the playoff cutoff ({playoffTeams} teams).</p> : null}
    </div>
  );
}
