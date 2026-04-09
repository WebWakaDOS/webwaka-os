/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/**
 * Low-data mode middleware tests (M7e)
 * Platform Invariants P4 (low-data mode), P6 (text content never stripped)
 * Minimum: 3 tests
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { lowDataMiddleware } from '../middleware/low-data.js';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function makeApp(): Hono {
  const app = new Hono();
  app.use('*', lowDataMiddleware);

  app.get('/discovery/posts', (c) =>
    c.json({
      posts: [
        {
          id: 'post_001',
          title: 'Ogoja Cultural Festival',
          body: 'Annual festival happening in Cross River State.',
          media_urls: ['https://cdn.webwaka.io/img/post_001.jpg', 'https://cdn.webwaka.io/img/post_002.jpg'],
          tags: ['culture', 'nigeria'],
        },
        {
          id: 'post_002',
          title: 'Harvest Season in Benue',
          body: 'Farm updates from Benue State.',
          media_urls: ['https://cdn.webwaka.io/img/post_003.jpg'],
          tags: ['farming'],
        },
      ],
      total: 2,
    }),
  );

  app.get('/profile', (c) =>
    c.json({
      user_id: 'usr_001',
      name: 'Chukwuemeka Eze',
      bio: 'Trader in Onitsha market.',
      avatar_url: 'https://cdn.webwaka.io/avatars/usr_001.jpg',
      media_urls: ['https://cdn.webwaka.io/media/usr_001_gallery.jpg'],
    }),
  );

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lowDataMiddleware', () => {
  it('strips media_urls when X-Low-Data: 1 header is present', async () => {
    const app = makeApp();
    const res = await app.request('/discovery/posts', {
      headers: { 'X-Low-Data': '1' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { posts: Array<{ media_urls: string[] }> };
    for (const post of body.posts) {
      expect(post.media_urls).toEqual([]);
    }
  });

  it('does NOT strip media_urls when X-Low-Data header is absent', async () => {
    const app = makeApp();
    const res = await app.request('/discovery/posts');
    expect(res.status).toBe(200);
    const body = await res.json() as { posts: Array<{ media_urls: string[] }> };
    expect(body.posts[0]?.media_urls).toHaveLength(2);
    expect(body.posts[1]?.media_urls).toHaveLength(1);
  });

  it('preserves all non-media fields when X-Low-Data: 1 (P6 — text content never stripped)', async () => {
    const app = makeApp();
    const res = await app.request('/discovery/posts', {
      headers: { 'X-Low-Data': '1' },
    });
    const body = await res.json() as { posts: Array<{ id: string; title: string; body: string; tags: string[] }> };
    const post = body.posts[0]!;
    expect(post.id).toBe('post_001');
    expect(post.title).toBe('Ogoja Cultural Festival');
    expect(post.body).toContain('Cross River State');
    expect(post.tags).toEqual(['culture', 'nigeria']);
  });

  it('strips nested media_urls in profile endpoint', async () => {
    const app = makeApp();
    const res = await app.request('/profile', {
      headers: { 'X-Low-Data': '1' },
    });
    const body = await res.json() as { user_id: string; name: string; media_urls: string[] };
    expect(body.user_id).toBe('usr_001');
    expect(body.name).toBe('Chukwuemeka Eze');
    expect(body.media_urls).toEqual([]);
  });
});
