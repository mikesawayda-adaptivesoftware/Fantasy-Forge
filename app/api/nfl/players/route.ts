import { getPlayers } from '@/lib/server/sleeper';
import { errorResponse, jsonResponse } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return jsonResponse(await getPlayers(), 60 * 60, request);
  } catch (error) {
    return errorResponse(error, 'players');
  }
}
