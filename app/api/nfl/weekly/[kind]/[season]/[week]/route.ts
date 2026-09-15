import { getNflState, getWeeklyProjections, getWeeklyStats, isSupportedSeason } from '@/lib/server/sleeper';
import { badRequest, errorResponse, isValidSeason, jsonResponse, parseWeek } from '@/lib/server/http';
import { resolveSeasonContext } from '@/lib/nfl';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; season: string; week: string }> }
) {
  const { kind, season, week: weekParam } = await params;
  if (kind !== 'stats' && kind !== 'projections') return badRequest('Invalid kind');
  if (!isValidSeason(season)) return badRequest('Invalid season');
  const week = parseWeek(weekParam);
  if (week === null) return badRequest('Invalid week');
  const idpParam = new URL(request.url).searchParams.get('idp');
  if (idpParam !== null && idpParam !== '1') return badRequest('idp must be 1 when present');
  const idp = idpParam === '1';

  try {
    if (!(await isSupportedSeason(season))) return badRequest('Season not available');
    const data = kind === 'stats' ? await getWeeklyStats(season, week, idp) : await getWeeklyProjections(season, week, idp);
    // Completed weeks rarely change; the current week updates constantly
    const ctx = resolveSeasonContext(await getNflState());
    const isPast = Number(season) < Number(ctx.season) || (season === ctx.season && week < ctx.week);
    return jsonResponse(data, isPast ? 6 * 60 * 60 : 60, request);
  } catch (error) {
    return errorResponse(error, `${kind} ${season} week ${week}${idp ? ' (idp)' : ''}`);
  }
}
