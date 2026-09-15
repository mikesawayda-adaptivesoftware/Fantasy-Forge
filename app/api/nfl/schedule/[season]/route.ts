import { getSchedule, isLiveSeason, isSupportedSeason } from '@/lib/server/sleeper';
import { badRequest, errorResponse, isValidSeason, jsonResponse } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  if (!isValidSeason(season)) return badRequest('Invalid season');
  try {
    if (!(await isSupportedSeason(season))) return badRequest('Season not available');
    const live = await isLiveSeason(season);
    return jsonResponse(await getSchedule(season), live ? 60 : 60 * 60, request);
  } catch (error) {
    return errorResponse(error, `schedule ${season}`);
  }
}
