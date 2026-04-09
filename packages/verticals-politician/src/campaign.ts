/**
 * Campaign donation + volunteer management.
 * (M8b — Platform Invariants T3, P9, P13)
 *
 * P9: All monetary amounts are integers in kobo.
 * P13: donor PII (phone) is never logged to AI usage events.
 * T3: All queries scoped to tenantId.
 *
 * Migration: 0048 — uses politician_profiles.workspace_id as FK anchor.
 * Donations are stored in a lightweight inline table created in 0048.
 *
 * Note: Full Paystack webhook handling lives in packages/payments.
 *       This module manages the donation record lifecycle only.
 */

import type {
  CampaignDonation,
  CreateDonationInput,
} from './types.js';

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

interface DonationRow {
  id: string;
  workspace_id: string;
  tenant_id: string;
  donor_phone: string;
  amount_kobo: number;
  paystack_ref: string | null;
  status: string;
  created_at: number;
}

function rowToDonation(row: DonationRow): CampaignDonation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    tenantId: row.tenant_id,
    donorPhone: row.donor_phone,
    amountKobo: row.amount_kobo,
    paystackRef: row.paystack_ref,
    status: row.status as CampaignDonation['status'],
    createdAt: row.created_at,
  };
}

export class CampaignRepository {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Donations
  // ---------------------------------------------------------------------------

  async createDonation(input: CreateDonationInput): Promise<CampaignDonation> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
      throw new Error('[campaign] amountKobo must be a positive integer (P9)');
    }

    const id = input.id ?? crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO campaign_donations
           (id, workspace_id, tenant_id, donor_phone, amount_kobo,
            paystack_ref, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', unixepoch())`,
      )
      .bind(
        id,
        input.workspaceId,
        input.tenantId,
        input.donorPhone,
        input.amountKobo,
        input.paystackRef ?? null,
      )
      .run();

    const donation = await this.findDonationById(id, input.tenantId);
    if (!donation) throw new Error('[campaign] Failed to create donation');
    return donation;
  }

  async findDonationById(id: string, tenantId: string): Promise<CampaignDonation | null> {
    const row = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, donor_phone, amount_kobo,
                paystack_ref, status, created_at
         FROM campaign_donations
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .first<DonationRow>();

    return row ? rowToDonation(row) : null;
  }

  async listDonationsByWorkspace(
    workspaceId: string,
    tenantId: string,
    limit = 50,
  ): Promise<CampaignDonation[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, donor_phone, amount_kobo,
                paystack_ref, status, created_at
         FROM campaign_donations
         WHERE workspace_id = ? AND tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(workspaceId, tenantId, limit)
      .all<DonationRow>();

    return (results ?? []).map(rowToDonation);
  }

  async confirmDonation(
    id: string,
    tenantId: string,
    paystackRef: string,
  ): Promise<CampaignDonation | null> {
    await this.db
      .prepare(
        `UPDATE campaign_donations
         SET status = 'confirmed', paystack_ref = ?
         WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      )
      .bind(paystackRef, id, tenantId)
      .run();

    return this.findDonationById(id, tenantId);
  }

  async failDonation(id: string, tenantId: string): Promise<CampaignDonation | null> {
    await this.db
      .prepare(
        `UPDATE campaign_donations
         SET status = 'failed'
         WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      )
      .bind(id, tenantId)
      .run();

    return this.findDonationById(id, tenantId);
  }

  async totalConfirmedKobo(workspaceId: string, tenantId: string): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COALESCE(SUM(amount_kobo), 0) AS total
         FROM campaign_donations
         WHERE workspace_id = ? AND tenant_id = ? AND status = 'confirmed'`,
      )
      .bind(workspaceId, tenantId)
      .first<{ total: number }>();

    return row?.total ?? 0;
  }
}
