'use client';

import { Suspense, useMemo, useState } from 'react';
import { FANTASY_POSITIONS, IDP_POSITIONS, Player, PlayerWithStats, TradePickValue, TradePlayerValue } from '@/types';
import { useFantasyData } from '@/lib/hooks/useFantasyData';
import { parseIdList, useQueryParams } from '@/lib/hooks/useQueryParam';
import { findUserRoster, useUserLeagues } from '@/lib/hooks/useUserLeagues';
import { useAsync } from '@/lib/hooks/useAsync';
import { getLeagueRosters, getLeagueTradedPicks, getLeagueUsers, getTeamName } from '@/lib/sleeper';
import { analyzeTrade, computeReplacementLevels, playerTradeValue } from '@/lib/scoring';
import { isDynastyLeague, leagueHasIdp, resolvePlayer, startersPerPositionForLeague } from '@/lib/league';
import { buildDraftPicks, describePick, dynastyAgeMultiplier, nextDraftSeason, pickValue } from '@/lib/dynasty';
import { compareStandings } from '@/lib/power-rankings';
import { getStartingSlots } from '@/lib/lineup';
import { blendedValue } from '@/lib/season';
import { formatPoints } from '@/lib/utils';
import LoadingState from '@/components/ui/LoadingState';
import ErrorState from '@/components/ui/ErrorState';
import SectionHeader from '@/components/ui/SectionHeader';
import PlayerCard from '@/components/ui/PlayerCard';
import PlayerPicker from '@/components/ui/PlayerPicker';
import LeagueSelect from '@/components/league/LeagueSelect';
import TradeFinder from '@/components/trade/TradeFinder';

type Side = 'give' | 'receive';

const PARAM_KEYS = ['give', 'receive', 'league', 'givePicks', 'receivePicks'] as const;

function TradeContent() {
  const [params, setParams] = useQueryParams(PARAM_KEYS);
  const [adding, setAdding] = useState<{ side: Side; kind: 'player' | 'pick' } | null>(null);
  const { user, leagues } = useUserLeagues();

  const league = leagues.find(l => l.league_id === params.league) ?? null;
  const idp = leagueHasIdp(league?.roster_positions);
  const dynasty = isDynastyLeague(league);
  const data = useFantasyData({ scoring: league?.scoring_settings, includeIdp: idp });

  const leagueData = useAsync(league ? league.league_id : null, async () => {
    const [rosters, users, tradedPicks] = await Promise.all([
      getLeagueRosters(league!.league_id),
      getLeagueUsers(league!.league_id),
      getLeagueTradedPicks(league!.league_id).catch(() => []),
    ]);
    return { rosters, users, tradedPicks };
  });

  const { players, listedPlayers, getPlayerWithStats, ctx } = data;
  const rosters = leagueData.data?.rosters ?? null;
  const userRoster = findUserRoster(rosters, user?.user_id);

  // Dynasty leagues weigh age; everything else uses the standard weekly value
  const valueFn = useMemo(
    () => (dynasty ? (p: PlayerWithStats) => playerTradeValue(p) * dynastyAgeMultiplier(p) : playerTradeValue),
    [dynasty]
  );

  const tradablePlayers = useMemo(
    () => (idp ? [...listedPlayers, ...players.filter(p => IDP_POSITIONS.includes(p.position) && p.team !== 'FA')] : listedPlayers),
    [idp, listedPlayers, players]
  );

  const replacementLevels = useMemo(() => {
    const pool = tradablePlayers.map(p => getPlayerWithStats(p.id)).filter((p): p is PlayerWithStats => p !== null);
    const starters = league ? startersPerPositionForLeague(league.roster_positions, league.total_rosters) : undefined;
    return computeReplacementLevels(pool, starters, valueFn);
  }, [tradablePlayers, getPlayerWithStats, league, valueFn]);

  const picks = useMemo(() => {
    if (!league || !rosters || !leagueData.data || !ctx) return [];
    const draftRounds = league.settings.draft_rounds ?? 4;
    const all = buildDraftPicks({
      rosters,
      tradedPicks: leagueData.data.tradedPicks,
      firstSeason: nextDraftSeason(league),
      seasons: dynasty ? 3 : 1,
      rounds: Math.min(draftRounds, dynasty ? 5 : draftRounds),
    });
    // Standings only predict draft order once games have been played
    const gamesPlayed = rosters.some(r => r.settings.wins + r.settings.losses + r.settings.ties > 0);
    const standingsRank = gamesPlayed ? new Map([...rosters].sort(compareStandings).map((r, i) => [r.roster_id, i + 1])) : undefined;
    const firstDraftSeason = nextDraftSeason(league);
    return all.map(pick => ({ pick, value: pickValue(pick, { firstDraftSeason, standingsRank, teams: rosters.length }) }));
  }, [league, rosters, leagueData.data, ctx, dynasty]);

  if (data.loading || leagueData.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={data.retry} />;

  const teamName = (rosterId: number) => {
    const roster = rosters?.find(r => r.roster_id === rosterId);
    const owner = leagueData.data?.users.find(u => u.user_id === roster?.owner_id);
    return getTeamName(owner, rosterId);
  };

  const ids = { give: parseIdList(params.give), receive: parseIdList(params.receive) };
  const pickIds = { give: parseIdList(params.givePicks), receive: parseIdList(params.receivePicks) };
  const toPlayers = (list: string[]) => list.map(id => getPlayerWithStats(id)).filter((p): p is PlayerWithStats => p !== null);
  const give = toPlayers(ids.give);
  const receive = toPlayers(ids.receive);
  const toPickValues = (list: string[]): TradePickValue[] =>
    list
      .map(id => picks.find(p => p.pick.id === id))
      .filter((p): p is (typeof picks)[number] => !!p)
      .map(({ pick, value }) => ({ id: pick.id, label: describePick(pick, teamName), value }));
  const givePicks = toPickValues(pickIds.give);
  const receivePicks = toPickValues(pickIds.receive);

  const hasGive = give.length + givePicks.length > 0;
  const hasReceive = receive.length + receivePicks.length > 0;
  const analysis = hasGive && hasReceive ? analyzeTrade(give, receive, replacementLevels, { valueFn, givePicks, receivePicks }) : null;

  const setList = (key: (typeof PARAM_KEYS)[number], list: string[]) => setParams({ [key]: list.join(',') || null });

  const handleAddPlayer = (player: Player) => {
    if (!adding) return;
    setList(adding.side, [...ids[adding.side], player.id]);
    setAdding(null);
  };

  const handleAddPick = (id: string) => {
    if (!adding) return;
    const key = adding.side === 'give' ? 'givePicks' : 'receivePicks';
    setList(key, [...pickIds[adding.side], id]);
    setAdding(null);
  };

  // In league mode, "give" comes from your roster and "receive" from everyone else's
  const rosterPlayerIds = (side: Side) => {
    if (!rosters || !userRoster) return null;
    const source = side === 'give' ? [userRoster] : rosters.filter(r => r.roster_id !== userRoster.roster_id);
    return new Set(source.flatMap(r => r.players ?? []));
  };
  const pickerPlayers = (side: Side) => {
    const allowed = rosterPlayerIds(side);
    return allowed ? players.filter(p => allowed.has(p.id)) : tradablePlayers;
  };
  const pickerPicks = (side: Side) =>
    picks.filter(({ pick }) => {
      if (pickIds.give.includes(pick.id) || pickIds.receive.includes(pick.id)) return false;
      if (!userRoster) return true;
      return side === 'give' ? pick.ownerRosterId === userRoster.roster_id : pick.ownerRosterId !== userRoster.roster_id;
    });

  const valueById = new Map<string, TradePlayerValue>(
    [...(analysis?.givePlayers ?? []), ...(analysis?.receivePlayers ?? [])].map(v => [v.player.id, v])
  );

  const toFinderInput = (id: string) => {
    const player = getPlayerWithStats(id);
    if (!player || ![...FANTASY_POSITIONS, ...(idp ? IDP_POSITIONS : [])].includes(player.position)) return null;
    const value =
      blendedValue({
        projection: player.projectedPoints ?? 0,
        avgPoints: player.avgPoints ?? 0,
        recentAvgPoints: player.recentAvgPoints ?? 0,
        gamesPlayed: player.gamesPlayed ?? 0,
      }) * (dynasty ? dynastyAgeMultiplier(player) : 1);
    return { id, position: player.position, positions: player.fantasyPositions, value, weekProjection: player.projectedPoints ?? 0 };
  };

  const renderSide = (side: Side) => {
    const sidePlayers = side === 'give' ? give : receive;
    const sidePicks = side === 'give' ? givePicks : receivePicks;
    const isGive = side === 'give';
    const addButton = (kind: 'player' | 'pick', label: string) => {
      const active = adding?.side === side && adding.kind === kind;
      return (
        <button
          type="button"
          onClick={() => setAdding(active ? null : { side, kind })}
          aria-expanded={active}
          className={`text-sm px-3 py-1 rounded-lg transition-all ${
            active
              ? isGive ? 'bg-turf text-black' : 'bg-gold text-black'
              : `bg-field-card border border-field-border text-text-secondary ${isGive ? 'hover:border-turf' : 'hover:border-gold'}`
          }`}
        >
          {label}
        </button>
      );
    };

    return (
      <div className="bg-field-card/30 border border-field-border rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className={isGive ? 'text-turf' : 'text-gold'} aria-hidden>{isGive ? '📤' : '📥'}</span>
            {isGive ? 'You Give' : 'You Receive'}
          </h3>
          <div className="flex gap-2">
            {addButton('player', '+ Player')}
            {picks.length > 0 && addButton('pick', '+ Pick')}
          </div>
        </div>

        {sidePlayers.length + sidePicks.length === 0 ? (
          <div className="text-center py-8 text-text-muted">Nothing added yet</div>
        ) : (
          <div className="space-y-2">
            {sidePlayers.map(player => {
              const value = valueById.get(player.id);
              return (
                <div key={player.id} className="relative">
                  <PlayerCard
                    player={player}
                    aside={
                      <div className="text-right flex-shrink-0 mr-6">
                        <div className={`stat-number text-lg ${isGive ? 'text-turf' : 'text-gold'}`}>
                          {value ? formatPoints(value.valueOverReplacement) : formatPoints(player.projectedPoints)}
                        </div>
                        <div className="text-xs text-text-muted">{value ? 'Value' : 'Projected'}</div>
                        {dynasty && player.age && <div className="text-xs text-text-muted">Age {player.age}</div>}
                      </div>
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setList(side, ids[side].filter(id => id !== player.id))}
                    aria-label={`Remove ${player.name}`}
                    className="absolute top-2 right-2 w-6 h-6 bg-red/80 text-white rounded-full text-xs hover:bg-red transition-colors"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {sidePicks.map(pick => (
              <div key={pick.id} className="flex items-center justify-between bg-field-card/50 border border-field-border rounded-xl p-3">
                <span className="text-white">🎟️ {pick.label}</span>
                <span className="flex items-center gap-3">
                  <span className={`stat-number ${isGive ? 'text-turf' : 'text-gold'}`}>{formatPoints(pick.value)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setList(side === 'give' ? 'givePicks' : 'receivePicks', pickIds[side].filter(id => id !== pick.id))
                    }
                    aria-label={`Remove ${pick.label}`}
                    className="w-6 h-6 bg-red/80 text-white rounded-full text-xs hover:bg-red transition-colors"
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {analysis && (
          <div className="mt-4 pt-4 border-t border-field-border flex justify-between text-sm">
            <span className="text-text-secondary">Total Value:</span>
            <span className={`stat-number ${isGive ? 'text-turf' : 'text-gold'}`}>
              {formatPoints(isGive ? analysis.giveValue : analysis.receiveValue)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const anything = hasGive || hasReceive;

  return (
    <div className="space-y-6">
      <SectionHeader icon="🔄" title="Trade Analyzer">
        {anything && (
          <button
            onClick={() => setParams({ give: null, receive: null, givePicks: null, receivePicks: null })}
            className="text-sm text-text-muted hover:text-red transition-colors"
          >
            Clear All
          </button>
        )}
      </SectionHeader>

      <p className="text-text-secondary">
        Players are valued by weekly points <em>over replacement level</em> – what you could find on waivers – so trading one star for
        several bench players is judged fairly.
        {dynasty && ' In dynasty leagues values are age-adjusted and draft picks can be included.'}
      </p>

      {leagues.length > 0 && (
        <LeagueSelect
          leagues={leagues}
          value={league?.league_id ?? null}
          onChange={id => setParams({ league: id, givePicks: null, receivePicks: null })}
          emptyLabel="No league – generic 12-team values"
          label="Value trades for"
        />
      )}

      <p className="text-text-muted text-sm">
        {data.scoringLabel} ·{' '}
        {league ? `${league.total_rosters}-team replacement levels from ${league.name}'s roster slots` : '12-team replacement levels'}
        {dynasty && ' · dynasty age curves'}
      </p>
      {leagueData.error && <p className="text-red text-sm">Couldn&apos;t load league rosters: {leagueData.error.message}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        {renderSide('give')}
        {renderSide('receive')}
      </div>

      {adding?.kind === 'player' && (
        <PlayerPicker
          title={`Add to "${adding.side === 'give' ? 'You Give' : 'You Receive'}"`}
          players={pickerPlayers(adding.side)}
          onSelect={handleAddPlayer}
          onClose={() => setAdding(null)}
          excludeIds={[...ids.give, ...ids.receive]}
          hint={userRoster ? (adding.side === 'give' ? 'Players on your roster' : 'Players on other rosters in this league') : undefined}
        />
      )}

      {adding?.kind === 'pick' && (
        <div className="bg-field-card/50 border border-field-border rounded-xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Add a draft pick</h3>
            <button type="button" onClick={() => setAdding(null)} className="text-text-muted hover:text-white" aria-label="Close pick picker">
              ✕
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto">
            {pickerPicks(adding.side).map(({ pick, value }) => (
              <button
                key={pick.id}
                type="button"
                onClick={() => handleAddPick(pick.id)}
                className="text-left bg-field-dark border border-field-border hover:border-turf rounded-lg px-3 py-2"
              >
                <span className="block text-white text-sm">{describePick(pick, teamName)}</span>
                <span className="block text-xs text-text-muted">
                  Owned by {teamName(pick.ownerRosterId)} · value {formatPoints(value)}
                </span>
              </button>
            ))}
            {pickerPicks(adding.side).length === 0 && <p className="text-sm text-text-muted">No picks available.</p>}
          </div>
        </div>
      )}

      {analysis && (
        <div className="bg-field-card/30 border border-field-border rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl" aria-hidden>📊</span>
            <h3 className="text-lg font-semibold text-white">Trade Analysis</h3>
          </div>

          <div
            className={`text-center p-6 rounded-xl mb-6 ${
              analysis.winner === 'give' ? 'bg-red/20 border border-red' : analysis.winner === 'receive' ? 'bg-turf/20 border border-turf' : 'bg-gold/20 border border-gold'
            }`}
          >
            <span className="text-4xl mb-2 block" aria-hidden>
              {analysis.winner === 'fair' ? '⚖️' : analysis.winner === 'receive' ? '🎉' : '⚠️'}
            </span>
            <p className={`text-xl font-bold ${analysis.winner === 'fair' ? 'text-gold' : analysis.winner === 'receive' ? 'text-turf' : 'text-red'}`}>
              {analysis.winner === 'fair' ? 'Fair Trade' : analysis.winner === 'receive' ? 'You Win This Trade!' : 'You Lose This Trade'}
            </p>
            <p className="text-text-secondary mt-1">{analysis.recommendation}</p>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-text-muted text-left border-b border-field-border">
                  <th className="pb-2 pr-4">Asset</th>
                  <th className="pb-2 pr-4">Side</th>
                  <th className="pb-2 pr-4 text-right">Weekly value</th>
                  <th className="pb-2 pr-4 text-right">Replacement</th>
                  <th className="pb-2 text-right">Counts as</th>
                </tr>
              </thead>
              <tbody>
                {[...analysis.givePlayers.map(v => ['Give', v] as const), ...analysis.receivePlayers.map(v => ['Receive', v] as const)].map(([side, v]) => (
                  <tr key={v.player.id} className="border-b border-field-border/50">
                    <td className="py-2 pr-4 text-white">
                      {v.player.name} <span className="text-text-muted text-xs">{v.player.position}</span>
                    </td>
                    <td className={`py-2 pr-4 ${side === 'Give' ? 'text-turf' : 'text-gold'}`}>{side}</td>
                    <td className="py-2 pr-4 text-right stat-number">{formatPoints(v.rawValue)}</td>
                    <td className="py-2 pr-4 text-right stat-number text-text-muted">{formatPoints(v.replacementValue)}</td>
                    <td className="py-2 text-right stat-number text-white">{formatPoints(v.valueOverReplacement)}</td>
                  </tr>
                ))}
                {[...analysis.givePicks.map(p => ['Give', p] as const), ...analysis.receivePicks.map(p => ['Receive', p] as const)].map(([side, p]) => (
                  <tr key={p.id} className="border-b border-field-border/50">
                    <td className="py-2 pr-4 text-white">🎟️ {p.label}</td>
                    <td className={`py-2 pr-4 ${side === 'Give' ? 'text-turf' : 'text-gold'}`}>{side}</td>
                    <td className="py-2 pr-4 text-right text-text-muted">pick</td>
                    <td className="py-2 pr-4 text-right text-text-muted">—</td>
                    <td className="py-2 text-right stat-number text-white">{formatPoints(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysis.rosterSpotNote && <div className="bg-field-dark rounded-lg p-4 text-text-secondary text-sm">💡 {analysis.rosterSpotNote}</div>}
        </div>
      )}

      {league && rosters && userRoster && (
        <TradeFinder
          key={league.league_id}
          slots={getStartingSlots(league.roster_positions)}
          userRoster={userRoster}
          rosters={rosters}
          toInput={toFinderInput}
          teamName={teamName}
          playerName={id => resolvePlayer(id, data.playersById).name}
          onLoad={idea => {
            setParams({ give: idea.giveIds.join(','), receive: idea.receiveIds.join(','), givePicks: null, receivePicks: null });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
      {league && rosters && !userRoster && (
        <p className="text-sm text-text-muted">Connect the Sleeper account that owns a team in {league.name} to use the trade finder.</p>
      )}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TradeContent />
    </Suspense>
  );
}
