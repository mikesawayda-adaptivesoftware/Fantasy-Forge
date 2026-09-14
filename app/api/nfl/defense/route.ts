import { getDefenseVsPosition } from '@/lib/server/sleeper';
import { errorResponse, jsonResponse } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return jsonResponse(await getDefenseVsPosition(), 30 * 60, request);
  } catch (error) {
    return errorResponse(error, 'defense vs position');
  }
}
