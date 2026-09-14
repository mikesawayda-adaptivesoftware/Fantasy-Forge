import { getTrending } from '@/lib/server/sleeper';
import { badRequest, errorResponse, jsonResponse } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Fixed options keep the cache small and upstream calls bounded
const ALLOWED_HOURS = new Set([24, 48, 168]);
const ALLOWED_LIMITS = new Set([25, 50, 100]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'add';
  const hours = Number(url.searchParams.get('hours') ?? 24);
  const limit = Number(url.searchParams.get('limit') ?? 50);
  if (type !== 'add' && type !== 'drop') return badRequest('Invalid type');
  if (!ALLOWED_HOURS.has(hours)) return badRequest('hours must be 24, 48 or 168');
  if (!ALLOWED_LIMITS.has(limit)) return badRequest('limit must be 25, 50 or 100');

  try {
    return jsonResponse(await getTrending(type, hours, limit), 10 * 60, request);
  } catch (error) {
    return errorResponse(error, 'trending');
  }
}
