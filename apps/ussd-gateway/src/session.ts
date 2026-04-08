/**
 * USSD session management — KV-backed with 3-minute TTL.
 * (TDR-0010 M7 extension, Platform Invariant T3)
 *
 * KV key format: `ussd:{sessionId}`
 * TTL: 180 seconds (Africa's Talking session timeout is 3 minutes)
 */

export type USSDState =
  | 'main_menu'
  | 'wallet_menu'
  | 'send_money_enter_recipient'
  | 'send_money_enter_amount'
  | 'send_money_confirm'
  | 'trending_feed'
  | 'trending_view_post'
  | 'transport_menu'
  | 'community_menu'
  | 'community_announcements'
  | 'community_events'
  | 'community_groups';

export interface USSDSession {
  sessionId: string;
  phone: string;
  state: USSDState;
  /** M7c: Record<string, unknown> to support arrays (trendingPosts, communityEvents) */
  data: Record<string, unknown>;
  createdAt: number;
}

/** Per TDR-0010 M7 extension — Africa's Talking 3-minute timeout */
const SESSION_TTL = 180;

interface KVLike {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Retrieve an existing USSD session or create a new one at main_menu.
 */
export async function getOrCreateSession(
  kv: KVLike,
  sessionId: string,
  phone: string,
): Promise<USSDSession> {
  const existing = await kv.get<USSDSession>(`ussd:${sessionId}`, 'json');
  if (existing) return existing;

  const session: USSDSession = {
    sessionId,
    phone,
    state: 'main_menu',
    data: {},
    createdAt: Date.now(),
  };
  await kv.put(`ussd:${sessionId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return session;
}

/**
 * Persist a session back to KV, refreshing TTL.
 */
export async function saveSession(kv: KVLike, session: USSDSession): Promise<void> {
  await kv.put(`ussd:${session.sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });
}

/**
 * Delete a session (called on END responses).
 */
export async function deleteSession(kv: KVLike, sessionId: string): Promise<void> {
  await kv.delete(`ussd:${sessionId}`);
}
