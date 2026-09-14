import { SleeperLeague, SleeperMatchup, SleeperRoster } from '@/types';

export interface WeeklyScores {
  week: number;
  /** roster_id -> points scored that week */
  scores: Record<number, number>;
}

export interface PowerRankingRow {
  rosterId: number;
  rank: number;
  powerScore: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  allPlayPct: number;
  /** Actual wins minus the wins expected from all-play win % */
  luckWins: number;
  pointsFor: number;
  pointsPerGame: number;
  maxPoints: number | null;
  /** pointsFor / maxPoints (lineup efficiency) */
  efficiency: number | null;
  recentAllPlayPct: number;
  weeksPlayed: number;
}

export const POWER_WEIGHTS = { allPlay: 0.5, pointsFor: 0.3, recent: 0.2 };

/** Combine integer + decimal parts Sleeper splits points into */
export function rosterPoints(whole?: number, decimal?: number): number {
  return (whole ?? 0) + (decimal ?? 0) / 100;
}

export function winPct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  return games > 0 ? (wins + ties * 0.5) / games : 0;
}

/** Standings order: win % (ties count half), then points for */
export function compareStandings(a: SleeperRoster, b: SleeperRoster): number {
  const pctDiff =
    winPct(b.settings.wins, b.settings.losses, b.settings.ties) -
    winPct(a.settings.wins, a.settings.losses, a.settings.ties);
  if (Math.abs(pctDiff) > 1e-9) return pctDiff;
  return rosterPoints(b.settings.fpts, b.settings.fpts_decimal) - rosterPoints(a.settings.fpts, a.settings.fpts_decimal);
}

/** Weeks whose results are final for power rankings */
export function getScoredWeeks(league: SleeperLeague, currentWeek: number): number[] {
  const start = league.settings.start_week ?? 1;
  const lastRegular = league.settings.playoff_week_start ? league.settings.playoff_week_start - 1 : 18;
  const lastScored = league.settings.last_scored_leg ?? currentWeek - 1;
  const end = Math.min(lastScored, lastRegular);
  const weeks: number[] = [];
  for (let week = start; week <= end; week++) weeks.push(week);
  return weeks;
}

export function toWeeklyScores(week: number, matchups: SleeperMatchup[]): WeeklyScores {
  const scores: Record<number, number> = {};
  for (const m of matchups) {
    if (m.matchup_id === null || m.matchup_id === undefined) continue;
    scores[m.roster_id] = m.custom_points ?? m.points ?? 0;
  }
  return { week, scores };
}

function allPlayForWeek(scores: Record<number, number>, rosterId: number) {
  const mine = scores[rosterId];
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const key in scores) {
    const other = Number(key);
    if (other === rosterId) continue;
    if (mine > scores[other]) wins++;
    else if (mine < scores[other]) losses++;
    else ties++;
  }
  return { wins, losses, ties };
}

/**
 * Power rankings blend how a team would do against everyone each week
 * (all-play), total scoring, and recent form. Luck compares actual wins to
 * all-play expectations.
 */
export function computePowerRankings(
  rosters: SleeperRoster[],
  weeks: WeeklyScores[],
  recentWeeks = 3
): PowerRankingRow[] {
  const playedWeeks = weeks.filter(w => Object.keys(w.scores).length > 1).sort((a, b) => a.week - b.week);
  const recent = playedWeeks.slice(-recentWeeks);

  const rows = rosters.map(roster => {
    const id = roster.roster_id;
    let apW = 0, apL = 0, apT = 0, pf = 0, weeksPlayed = 0;
    for (const w of playedWeeks) {
      if (w.scores[id] === undefined) continue;
      const r = allPlayForWeek(w.scores, id);
      apW += r.wins; apL += r.losses; apT += r.ties;
      pf += w.scores[id];
      weeksPlayed++;
    }
    let rW = 0, rL = 0, rT = 0;
    for (const w of recent) {
      if (w.scores[id] === undefined) continue;
      const r = allPlayForWeek(w.scores, id);
      rW += r.wins; rL += r.losses; rT += r.ties;
    }

    const { wins, losses, ties } = roster.settings;
    const actualPct = winPct(wins, losses, ties);
    const allPlayPct = winPct(apW, apL, apT);
    const games = wins + losses + ties;
    const pointsFor = weeksPlayed > 0 ? pf : rosterPoints(roster.settings.fpts, roster.settings.fpts_decimal);
    const maxPoints = roster.settings.ppts !== undefined ? rosterPoints(roster.settings.ppts, roster.settings.ppts_decimal) : null;

    return {
      rosterId: id,
      rank: 0,
      powerScore: 0,
      wins,
      losses,
      ties,
      winPct: actualPct,
      allPlayWins: apW,
      allPlayLosses: apL,
      allPlayTies: apT,
      allPlayPct,
      luckWins: round1((actualPct - allPlayPct) * games),
      pointsFor: round1(pointsFor),
      pointsPerGame: weeksPlayed > 0 ? round1(pointsFor / weeksPlayed) : 0,
      maxPoints: maxPoints !== null && maxPoints > 0 ? round1(maxPoints) : null,
      efficiency: maxPoints ? Math.min(1, pointsFor / maxPoints) : null,
      recentAllPlayPct: winPct(rW, rL, rT),
      weeksPlayed,
    };
  });

  const maxPpg = Math.max(0, ...rows.map(r => r.pointsPerGame));
  for (const row of rows) {
    const pfScore = maxPpg > 0 ? row.pointsPerGame / maxPpg : 0;
    row.powerScore = Math.round(
      (row.allPlayPct * POWER_WEIGHTS.allPlay + pfScore * POWER_WEIGHTS.pointsFor + row.recentAllPlayPct * POWER_WEIGHTS.recent) * 1000
    ) / 10;
  }

  rows.sort((a, b) => b.powerScore - a.powerScore || b.pointsFor - a.pointsFor);
  rows.forEach((row, index) => (row.rank = index + 1));
  return rows;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
