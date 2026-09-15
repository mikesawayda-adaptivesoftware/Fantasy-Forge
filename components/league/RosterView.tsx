'use client';

import { FantasyData } from '@/lib/hooks/useFantasyData';
import { LeagueData } from '@/lib/hooks/useLeagueData';
import { getStartingSlots, slotLabel } from '@/lib/lineup';
import { getBenchIds, getCurrentStarters, resolvePlayer } from '@/lib/league';
import { formatPoints } from '@/lib/utils';
import RosterPlayerRow from './RosterPlayerRow';

export default function RosterView({ league, data }: { league: LeagueData; data: FantasyData }) {
  const { userRoster, userMatchup, week } = league;

  if (!userRoster || !week) {
    return (
      <div className="text-center py-8 bg-field-card/30 rounded-xl border border-field-border">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="text-text-secondary">Could not find your team in this league.</p>
      </div>
    );
  }

  const slots = getStartingSlots(league.league?.roster_positions);
  const starters = getCurrentStarters(userRoster, userMatchup);
  const bench = getBenchIds(userRoster, starters);
  const projectedTotal = starters.reduce((sum, id) => sum + (data.projected.get(id) ?? 0), 0);

  const renderRow = (id: string, slot?: string, key?: string) => {
    const player = resolvePlayer(id, data.playersById);
    const season = data.seasons.get(id);
    return (
      <RosterPlayerRow
        key={key ?? id}
        player={player}
        slot={slot}
        matchup={data.getMatchup(player, week)}
        right={
          <>
            <div className="stat-number text-sm text-gold">{formatPoints(data.projected.get(id))}</div>
            <div className="text-xs text-text-muted">avg {formatPoints(season?.avgPoints)}</div>
          </>
        }
      />
    );
  };

  const sections = [
    { title: 'Bench', icon: '🪑', ids: bench },
    { title: 'Injured Reserve', icon: '🏥', ids: userRoster.reserve ?? [] },
    { title: 'Taxi Squad', icon: '🚕', ids: userRoster.taxi ?? [] },
  ].filter(section => section.ids.length > 0);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-field-card/50 border border-field-border rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span aria-hidden>⭐</span> Starters
          <span className="text-text-muted text-sm font-normal">({formatPoints(projectedTotal)} projected)</span>
        </h3>
        <div className="space-y-2">
          {starters.map((id, index) =>
            !id || id === '0' ? (
              <RosterPlayerRow key={`empty-${index}`} player={null} slot={slotLabel(slots[index] ?? '')} />
            ) : (
              renderRow(id, slotLabel(slots[index] ?? ''), `${id}-${index}`)
            )
          )}
        </div>
      </div>

      <div className="space-y-6">
        {sections.map(section => (
          <div key={section.title} className="bg-field-card/50 border border-field-border rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span aria-hidden>{section.icon}</span> {section.title}
            </h3>
            <div className="space-y-2">{section.ids.map(id => renderRow(id))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
