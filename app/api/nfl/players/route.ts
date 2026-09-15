import { getPlayersWithInjuries } from '@/lib/server/sleeper';
import { errorResponse, jsonResponse } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Injury data refreshes every ~20 minutes, so keep the browser cache short
    return jsonResponse(await getPlayersWithInjuries(), 10 * 60, request);
  } catch (error) {
    return errorResponse(error, 'players');
  }
}
