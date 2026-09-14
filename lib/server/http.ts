import { gzipSync } from 'node:zlib';
import { SleeperError } from './sleeper';

// Route handler responses aren't compressed by Next, so gzip JSON ourselves.
// Cached data objects are reused between requests, so memoize by identity.
const gzipCache = new WeakMap<object, Uint8Array<ArrayBuffer>>();
const MIN_GZIP_BYTES = 1024;

/** JSON response with browser + CDN cache headers (gzipped when accepted) */
export function jsonResponse(data: unknown, maxAgeSeconds: number, request?: Request): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`,
    Vary: 'Accept-Encoding',
  };
  const acceptsGzip = request?.headers.get('accept-encoding')?.includes('gzip') ?? false;

  if (acceptsGzip && data !== null && typeof data === 'object') {
    let body = gzipCache.get(data);
    if (!body) {
      const json = JSON.stringify(data);
      if (json.length >= MIN_GZIP_BYTES) {
        body = new Uint8Array(gzipSync(json));
        gzipCache.set(data, body);
      } else {
        return new Response(json, { headers });
      }
    }
    return new Response(body, { headers: { ...headers, 'Content-Encoding': 'gzip' } });
  }

  return new Response(JSON.stringify(data), { headers });
}

export function errorResponse(error: unknown, context: string): Response {
  console.error(`[api] ${context}`, error);
  const status = error instanceof SleeperError && error.status === 404 ? 404 : 502;
  return Response.json(
    { error: status === 404 ? 'Not found' : 'Upstream data provider is unavailable. Please try again shortly.' },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

export function isValidSeason(season: string): boolean {
  return /^\d{4}$/.test(season);
}

export function parseWeek(week: string): number | null {
  if (!/^\d{1,2}$/.test(week)) return null;
  const n = Number(week);
  return n >= 1 && n <= 18 ? n : null;
}
