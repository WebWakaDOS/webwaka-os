/**
 * Low-data mode middleware (M7e, Platform Invariant P4/P6)
 *
 * When request header X-Low-Data: 1 is present, recursively strip
 * all `media_urls` arrays from JSON response bodies.
 *
 * P6: Text content is NEVER stripped — only media arrays.
 * Only applies to JSON responses. Binary/text responses pass through.
 */
import type { MiddlewareHandler } from 'hono';

export const lowDataMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  if (c.req.header('X-Low-Data') !== '1') return;

  const contentType = c.res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) return;

  try {
    const body = await c.res.clone().json<Record<string, unknown>>();
    const stripped = stripMediaUrls(body);
    c.res = new Response(JSON.stringify(stripped), {
      status: c.res.status,
      headers: c.res.headers,
    });
  } catch {
    // Non-parseable response — pass through unchanged
  }
};

function stripMediaUrls(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripMediaUrls);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = key === 'media_urls' ? [] : stripMediaUrls(val);
    }
    return result;
  }
  return obj;
}
