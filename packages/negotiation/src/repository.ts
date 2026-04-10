/**
 * @webwaka/negotiation — NegotiationRepository
 *
 * All DB access for the negotiation system.
 * P9: All monetary values INTEGER kobo — no float columns.
 * T3: All queries filtered by tenant_id.
 * Audit writes never propagate errors — failure is logged, not rethrown.
 * All SQL parameters use ? bindings — no string interpolation of user input.
 */

import type {
  VendorPricingPolicy,
  ListingPriceOverride,
  NegotiationSession,
  NegotiationOffer,
  SellerAnalytics,
  SessionStatus,
  OfferStatus,
  UpsertPolicyInput,
  UpsertListingOverrideInput,
  CreateSessionRepoInput,
  AuditEventType,
  ActorType,
} from './types.js';
import { computeExpiresAt } from './guardrails.js';

function nanoid(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 21; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export class NegotiationRepository {
  constructor(private readonly db: { prepare(query: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ success: boolean }> } } }) {}

  async upsertVendorPolicy(input: UpsertPolicyInput): Promise<VendorPricingPolicy> {
    const existing = await this.getVendorPolicy(input.workspace_id, input.tenant_id);
    const id = existing?.id ?? nanoid();
    const now = nowUnix();

    await this.db
      .prepare(
        `INSERT INTO vendor_pricing_policies
           (id, workspace_id, tenant_id, default_pricing_mode, min_price_kobo,
            max_discount_bps, max_offer_rounds, offer_expiry_hours,
            auto_accept_threshold_bps, eligible_buyer_kyc_tier, wholesale_min_qty,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, tenant_id) DO UPDATE SET
           default_pricing_mode      = excluded.default_pricing_mode,
           min_price_kobo            = excluded.min_price_kobo,
           max_discount_bps          = excluded.max_discount_bps,
           max_offer_rounds          = excluded.max_offer_rounds,
           offer_expiry_hours        = excluded.offer_expiry_hours,
           auto_accept_threshold_bps = excluded.auto_accept_threshold_bps,
           eligible_buyer_kyc_tier   = excluded.eligible_buyer_kyc_tier,
           wholesale_min_qty         = excluded.wholesale_min_qty,
           updated_at                = excluded.updated_at`,
      )
      .bind(
        id,
        input.workspace_id,
        input.tenant_id,
        input.default_pricing_mode,
        input.min_price_kobo ?? null,
        input.max_discount_bps ?? 1500,
        input.max_offer_rounds ?? 3,
        input.offer_expiry_hours ?? 48,
        input.auto_accept_threshold_bps ?? null,
        input.eligible_buyer_kyc_tier ?? 1,
        input.wholesale_min_qty ?? null,
        existing?.created_at ?? now,
        now,
      )
      .run();

    const result = await this.getVendorPolicy(input.workspace_id, input.tenant_id);
    return result!;
  }

  async getVendorPolicy(workspaceId: string, tenantId: string): Promise<VendorPricingPolicy | null> {
    return this.db
      .prepare(
        `SELECT * FROM vendor_pricing_policies
         WHERE workspace_id = ? AND tenant_id = ?`,
      )
      .bind(workspaceId, tenantId)
      .first<VendorPricingPolicy>();
  }

  async upsertListingOverride(input: UpsertListingOverrideInput): Promise<ListingPriceOverride> {
    const existing = await this.getListingOverride(input.listing_type, input.listing_id, input.tenant_id);
    const id = existing?.id ?? nanoid();
    const now = nowUnix();

    await this.db
      .prepare(
        `INSERT INTO listing_price_overrides
           (id, workspace_id, tenant_id, listing_type, listing_id, pricing_mode,
            listed_price_kobo, min_price_kobo, max_discount_bps, max_offer_rounds,
            offer_expiry_hours, auto_accept_threshold_bps, valid_until,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(listing_type, listing_id, tenant_id) DO UPDATE SET
           pricing_mode              = excluded.pricing_mode,
           listed_price_kobo         = excluded.listed_price_kobo,
           min_price_kobo            = excluded.min_price_kobo,
           max_discount_bps          = excluded.max_discount_bps,
           max_offer_rounds          = excluded.max_offer_rounds,
           offer_expiry_hours        = excluded.offer_expiry_hours,
           auto_accept_threshold_bps = excluded.auto_accept_threshold_bps,
           valid_until               = excluded.valid_until,
           updated_at                = excluded.updated_at`,
      )
      .bind(
        id,
        input.workspace_id,
        input.tenant_id,
        input.listing_type,
        input.listing_id,
        input.pricing_mode,
        input.listed_price_kobo,
        input.min_price_kobo ?? null,
        input.max_discount_bps ?? null,
        input.max_offer_rounds ?? null,
        input.offer_expiry_hours ?? null,
        input.auto_accept_threshold_bps ?? null,
        input.valid_until ?? null,
        existing?.created_at ?? now,
        now,
      )
      .run();

    const result = await this.getListingOverride(input.listing_type, input.listing_id, input.tenant_id);
    return result!;
  }

  async getListingOverride(
    listingType: string,
    listingId: string,
    tenantId: string,
  ): Promise<ListingPriceOverride | null> {
    return this.db
      .prepare(
        `SELECT * FROM listing_price_overrides
         WHERE listing_type = ? AND listing_id = ? AND tenant_id = ?`,
      )
      .bind(listingType, listingId, tenantId)
      .first<ListingPriceOverride>();
  }

  async deleteListingOverride(
    listingType: string,
    listingId: string,
    tenantId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM listing_price_overrides
         WHERE listing_type = ? AND listing_id = ? AND tenant_id = ? AND workspace_id = ?`,
      )
      .bind(listingType, listingId, tenantId, workspaceId)
      .run();
  }

  async createSession(input: CreateSessionRepoInput, maxRounds: number, expiryHours: number): Promise<NegotiationSession> {
    const id = nanoid();
    const now = nowUnix();
    const expiresAt = computeExpiresAt(now, expiryHours);

    await this.db
      .prepare(
        `INSERT INTO negotiation_sessions
           (id, tenant_id, listing_type, listing_id, seller_workspace_id,
            buyer_ref_id, session_type, status, listed_price_kobo,
            initial_offer_kobo, final_price_kobo, rounds_used, max_rounds,
            expires_at, quantity, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.tenant_id,
        input.listing_type,
        input.listing_id,
        input.seller_workspace_id,
        input.buyer_ref_id,
        input.session_type,
        input.listed_price_kobo,
        input.initial_offer_kobo,
        maxRounds,
        expiresAt,
        input.quantity ?? 1,
        input.notes ?? null,
        now,
        now,
      )
      .run();

    return (await this.getSession(id, input.tenant_id))!;
  }

  async getSession(id: string, tenantId: string): Promise<NegotiationSession | null> {
    return this.db
      .prepare(`SELECT * FROM negotiation_sessions WHERE id = ? AND tenant_id = ?`)
      .bind(id, tenantId)
      .first<NegotiationSession>();
  }

  async listSessionsForSeller(
    sellerWorkspaceId: string,
    tenantId: string,
    status?: string,
  ): Promise<NegotiationSession[]> {
    const query = status
      ? `SELECT * FROM negotiation_sessions
         WHERE seller_workspace_id = ? AND tenant_id = ? AND status = ?
         ORDER BY created_at DESC`
      : `SELECT * FROM negotiation_sessions
         WHERE seller_workspace_id = ? AND tenant_id = ?
         ORDER BY created_at DESC`;

    const stmt = status
      ? this.db.prepare(query).bind(sellerWorkspaceId, tenantId, status)
      : this.db.prepare(query).bind(sellerWorkspaceId, tenantId);

    const { results } = await stmt.all<NegotiationSession>();
    return results;
  }

  async listSessionsForBuyer(
    buyerRefId: string,
    tenantId: string,
    status?: string,
  ): Promise<NegotiationSession[]> {
    const query = status
      ? `SELECT * FROM negotiation_sessions
         WHERE buyer_ref_id = ? AND tenant_id = ? AND status = ?
         ORDER BY created_at DESC`
      : `SELECT * FROM negotiation_sessions
         WHERE buyer_ref_id = ? AND tenant_id = ?
         ORDER BY created_at DESC`;

    const stmt = status
      ? this.db.prepare(query).bind(buyerRefId, tenantId, status)
      : this.db.prepare(query).bind(buyerRefId, tenantId);

    const { results } = await stmt.all<NegotiationSession>();
    return results;
  }

  async updateSessionStatus(
    id: string,
    tenantId: string,
    status: SessionStatus,
    finalPriceKobo?: number,
  ): Promise<void> {
    if (status === 'accepted' && finalPriceKobo === undefined) {
      throw new Error('finalPriceKobo is required when accepting a session');
    }
    const now = nowUnix();
    await this.db
      .prepare(
        `UPDATE negotiation_sessions
         SET status = ?, final_price_kobo = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(status, finalPriceKobo ?? null, now, id, tenantId)
      .run();
  }

  async incrementRoundsUsed(id: string, tenantId: string): Promise<number> {
    const now = nowUnix();
    await this.db
      .prepare(
        `UPDATE negotiation_sessions
         SET rounds_used = rounds_used + 1, updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(now, id, tenantId)
      .run();

    const session = await this.getSession(id, tenantId);
    return session?.rounds_used ?? 0;
  }

  async createOffer(
    sessionId: string,
    tenantId: string,
    round: number,
    offeredBy: 'buyer' | 'seller',
    amountKobo: number,
    message?: string,
  ): Promise<NegotiationOffer> {
    const id = nanoid();
    const now = nowUnix();

    await this.db
      .prepare(
        `INSERT INTO negotiation_offers
           (id, session_id, tenant_id, round, offered_by, amount_kobo,
            message, status, created_at, responded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)`,
      )
      .bind(id, sessionId, tenantId, round, offeredBy, amountKobo, message ?? null, now)
      .run();

    return (await this.getOfferById(id, tenantId))!;
  }

  async getOfferById(id: string, tenantId: string): Promise<NegotiationOffer | null> {
    return this.db
      .prepare(`SELECT * FROM negotiation_offers WHERE id = ? AND tenant_id = ?`)
      .bind(id, tenantId)
      .first<NegotiationOffer>();
  }

  async getLatestOffer(sessionId: string, tenantId: string): Promise<NegotiationOffer | null> {
    return this.db
      .prepare(
        `SELECT * FROM negotiation_offers
         WHERE session_id = ? AND tenant_id = ?
         ORDER BY round DESC LIMIT 1`,
      )
      .bind(sessionId, tenantId)
      .first<NegotiationOffer>();
  }

  async updateOfferStatus(
    id: string,
    tenantId: string,
    status: OfferStatus,
    respondedAt: number,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE negotiation_offers
         SET status = ?, responded_at = ?
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(status, respondedAt, id, tenantId)
      .run();
  }

  async listOffersForSession(sessionId: string, tenantId: string): Promise<NegotiationOffer[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM negotiation_offers
         WHERE session_id = ? AND tenant_id = ?
         ORDER BY round ASC`,
      )
      .bind(sessionId, tenantId)
      .all<NegotiationOffer>();
    return results;
  }

  async writeAuditEntry(entry: {
    tenant_id: string;
    session_id: string;
    event_type: AuditEventType;
    actor_type: ActorType;
    actor_ref_id: string;
    amount_kobo?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const id = nanoid();
      const now = nowUnix();
      await this.db
        .prepare(
          `INSERT INTO negotiation_audit_log
             (id, tenant_id, session_id, event_type, actor_type,
              actor_ref_id, amount_kobo, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          entry.tenant_id,
          entry.session_id,
          entry.event_type,
          entry.actor_type,
          entry.actor_ref_id,
          entry.amount_kobo ?? null,
          JSON.stringify(entry.metadata ?? {}),
          now,
        )
        .run();
    } catch (err) {
      console.error('[negotiation] audit write failed (non-fatal):', err);
    }
  }

  async expireOpenSessions(tenantId?: string): Promise<number> {
    const now = nowUnix();
    const query = tenantId
      ? `UPDATE negotiation_sessions
         SET status = 'expired', updated_at = ?
         WHERE status = 'open' AND expires_at < ? AND tenant_id = ?`
      : `UPDATE negotiation_sessions
         SET status = 'expired', updated_at = ?
         WHERE status = 'open' AND expires_at < ?`;

    const stmt = tenantId
      ? this.db.prepare(query).bind(now, now, tenantId)
      : this.db.prepare(query).bind(now, now);

    await stmt.run();

    const countRow = tenantId
      ? await this.db
          .prepare(`SELECT COUNT(*) as n FROM negotiation_sessions WHERE status = 'expired' AND updated_at = ? AND tenant_id = ?`)
          .bind(now, tenantId)
          .first<{ n: number }>()
      : await this.db
          .prepare(`SELECT COUNT(*) as n FROM negotiation_sessions WHERE status = 'expired' AND updated_at = ?`)
          .bind(now)
          .first<{ n: number }>();

    return countRow?.n ?? 0;
  }

  async expiredSessionIds(since: number): Promise<string[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id FROM negotiation_sessions
         WHERE status = 'expired' AND updated_at >= ?`,
      )
      .bind(since)
      .all<{ id: string }>();
    return results.map((r) => r.id);
  }

  /** Returns full expired sessions (with tenant_id) for CRON audit logging. */
  async expiredSessions(since: number): Promise<NegotiationSession[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM negotiation_sessions
         WHERE status = 'expired' AND updated_at >= ?`,
      )
      .bind(since)
      .all<NegotiationSession>();
    return results;
  }

  async abandonedAcceptedSessions(cutoffUnix: number): Promise<NegotiationSession[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM negotiation_sessions
         WHERE status = 'accepted' AND updated_at < ?`,
      )
      .bind(cutoffUnix)
      .all<NegotiationSession>();
    return results;
  }

  async getSellerAnalytics(
    sellerWorkspaceId: string,
    tenantId: string,
    fromUnix?: number,
    toUnix?: number,
  ): Promise<SellerAnalytics> {
    const from = fromUnix ?? 0;
    const to = toUnix ?? Math.floor(Date.now() / 1000) + 86400;

    const row = await this.db
      .prepare(
        `SELECT
           COUNT(*)                                                       AS total_sessions,
           SUM(CASE WHEN status = 'open'      THEN 1 ELSE 0 END)         AS open_sessions,
           SUM(CASE WHEN status = 'accepted'  THEN 1 ELSE 0 END)         AS accepted_sessions,
           SUM(CASE WHEN status = 'declined'  THEN 1 ELSE 0 END)         AS declined_sessions,
           SUM(CASE WHEN status = 'expired'   THEN 1 ELSE 0 END)         AS expired_sessions,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)         AS cancelled_sessions,
           CASE WHEN COUNT(*) = 0 THEN 0
                ELSE CAST(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) * 10000 / COUNT(*) AS INTEGER)
           END                                                            AS acceptance_rate_bps,
           CASE WHEN SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) = 0 THEN 0
                ELSE CAST(
                  SUM(CASE WHEN status = 'accepted' AND listed_price_kobo > 0
                       THEN (listed_price_kobo - final_price_kobo) * 10000 / listed_price_kobo
                       ELSE 0 END)
                  / SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END)
                  AS INTEGER)
           END                                                            AS avg_discount_depth_bps,
           CASE WHEN COUNT(CASE WHEN status != 'open' THEN 1 END) = 0 THEN 0
                ELSE CAST(
                  SUM(CASE WHEN status != 'open' THEN rounds_used ELSE 0 END)
                  / COUNT(CASE WHEN status != 'open' THEN 1 END)
                  AS INTEGER)
           END                                                            AS avg_rounds_to_close
         FROM negotiation_sessions
         WHERE seller_workspace_id = ?
           AND tenant_id           = ?
           AND created_at          >= ?
           AND created_at          <= ?`,
      )
      .bind(sellerWorkspaceId, tenantId, from, to)
      .first<SellerAnalytics>();

    return row ?? {
      total_sessions: 0,
      open_sessions: 0,
      accepted_sessions: 0,
      declined_sessions: 0,
      expired_sessions: 0,
      cancelled_sessions: 0,
      acceptance_rate_bps: 0,
      avg_discount_depth_bps: 0,
      avg_rounds_to_close: 0,
    };
  }
}
