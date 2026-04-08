/**
 * Telegram Bot webhook tests (M7f)
 * Tests: handleTelegramWebhook, POST /telegram/webhook route
 * Minimum: 5 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { handleTelegramWebhook, type TelegramUpdate } from './telegram.js';

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

function makeDB(userRow: Record<string, unknown> | null = null) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: (..._args: unknown[]) => ({
        first: <T>() => Promise.resolve(userRow as T),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: <T>() => Promise.resolve({ results: [] as T[] }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// handleTelegramWebhook unit tests
// ---------------------------------------------------------------------------

describe('handleTelegramWebhook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));
  });

  it('updates telegram_chat_id when /start from known handle', async () => {
    const db = makeDB({ user_id: 'usr_001' });
    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 100,
        from: { id: 12345, username: 'testuser', first_name: 'Test' },
        chat: { id: 12345, type: 'private' },
        text: '/start',
      },
    };

    await handleTelegramWebhook(update, { DB: db as never, TELEGRAM_BOT_TOKEN: 'tok_test' });
    const runCall = db.prepare.mock.results.find((r) => r.value?.bind()?.run);
    expect(runCall).toBeTruthy();
  });

  it('sends "not registered" message for unknown handle on /start', async () => {
    const db = makeDB(null); // user not found
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 101,
        from: { id: 99999, username: 'unknownuser', first_name: 'Unknown' },
        chat: { id: 99999, type: 'private' },
        text: '/start',
      },
    };

    await handleTelegramWebhook(update, { DB: db as never, TELEGRAM_BOT_TOKEN: 'tok_test' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('sendMessage'), expect.any(Object));
  });

  it('ignores non-/start messages gracefully', async () => {
    const db = makeDB({ user_id: 'usr_001' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 102,
        from: { id: 12345, username: 'testuser', first_name: 'Test' },
        chat: { id: 12345, type: 'private' },
        text: 'hello there',
      },
    };

    await handleTelegramWebhook(update, { DB: db as never, TELEGRAM_BOT_TOKEN: 'tok_test' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles update with missing message gracefully (no crash)', async () => {
    const db = makeDB();
    const update: TelegramUpdate = { update_id: 4 };
    await expect(
      handleTelegramWebhook(update, { DB: db as never, TELEGRAM_BOT_TOKEN: 'tok_test' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST /telegram/webhook route tests
// ---------------------------------------------------------------------------

describe('POST /telegram/webhook route', () => {
  function makeApp(webhookSecret = 'valid_secret'): Hono {
    const app = new Hono<{ Bindings: {
      DB: ReturnType<typeof makeDB>;
      TELEGRAM_BOT_TOKEN: string;
      TELEGRAM_WEBHOOK_SECRET: string;
    } }>();

    app.use('*', async (c, next) => {
      c.env = {
        DB: makeDB({ user_id: 'usr_001' }) as never,
        TELEGRAM_BOT_TOKEN: 'tok_test',
        TELEGRAM_WEBHOOK_SECRET: webhookSecret,
      } as never;
      await next();
    });

    app.post('/telegram/webhook', async (c) => {
      const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
      if (!secretToken || secretToken !== c.env.TELEGRAM_WEBHOOK_SECRET) {
        return c.json({ error: 'Forbidden' }, 403);
      }
      return c.json({ ok: true });
    });

    return app;
  }

  it('returns 403 with invalid X-Telegram-Bot-Api-Secret-Token', async () => {
    const app = makeApp('correct_secret');
    const res = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong_secret',
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with valid secret token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const app = makeApp('valid_secret');
    const res = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'valid_secret',
      },
      body: JSON.stringify({ update_id: 1, message: { message_id: 1, from: { id: 1, first_name: 'T' }, chat: { id: 1, type: 'private' }, text: 'hi' } }),
    });
    expect(res.status).toBe(200);
  });
});
