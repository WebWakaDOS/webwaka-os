# Used-Car-Dealer Informal Negotiation Backfill Guide

**Context:** Before the formal negotiation engine (migrations 0181–0185),
`used_car_dealer` listings had two informal negotiation columns:
- `offer_price_kobo` — a single offer field (no counteroffer chain)
- `status = 'negotiating'` — a flag, not a full FSM

This guide explains how to migrate existing rows into the formal `negotiation_sessions`
and `negotiation_offers` tables.

## Listing Type Convention

The `listing_type` value used in all negotiation tables for used-car listings is:

```
'used_car'
```

This matches the entity name in the vertical's catalog table, not the package name
(`verticals-used-car-dealer`).

## Who Runs This

This is a one-time data migration, run by platform ops after migrations 0181–0185
have been applied and before the negotiation UI is made visible to buyers.

## Step-by-Step

### 1. Identify rows to backfill

```sql
SELECT id, workspace_id, tenant_id, offer_price_kobo, asking_price_kobo
FROM used_car_dealer_listings
WHERE status = 'negotiating'
  AND offer_price_kobo IS NOT NULL
  AND offer_price_kobo > 0;
```

### 2. For each row: ensure a vendor_pricing_policies row exists

If the seller workspace does not yet have a policy row (because they haven't
used the new UI), insert a default policy:

```sql
INSERT OR IGNORE INTO vendor_pricing_policies
  (id, workspace_id, tenant_id, default_pricing_mode,
   max_discount_bps, max_offer_rounds, offer_expiry_hours,
   eligible_buyer_kyc_tier, created_at, updated_at)
VALUES
  (lower(hex(randomblob(10))), :workspace_id, :tenant_id, 'negotiable',
   1500, 3, 48, 1, unixepoch(), unixepoch());
```

### 3. Insert a negotiation_session row

```sql
INSERT INTO negotiation_sessions
  (id, tenant_id, listing_type, listing_id, seller_workspace_id,
   buyer_ref_id, session_type, status, listed_price_kobo,
   initial_offer_kobo, final_price_kobo, rounds_used, max_rounds,
   expires_at, quantity, notes, created_at, updated_at)
VALUES
  (lower(hex(randomblob(10))),
   :tenant_id,
   'used_car',
   :listing_id,
   :workspace_id,
   'backfill_buyer_unknown',
   'offer',
   'open',
   :asking_price_kobo,
   :offer_price_kobo,
   NULL,
   1,
   3,
   unixepoch() + (48 * 3600),
   1,
   'Backfilled from pre-engine informal negotiation',
   unixepoch(),
   unixepoch());
```

Note: `buyer_ref_id = 'backfill_buyer_unknown'` is a sentinel value for backfilled rows
where the original offer was not linked to a buyer account. Platform support should
contact the seller to confirm or close these sessions manually.

### 4. Insert a negotiation_offer row

```sql
INSERT INTO negotiation_offers
  (id, session_id, tenant_id, round, offered_by, amount_kobo,
   message, status, created_at, responded_at)
VALUES
  (lower(hex(randomblob(10))),
   :session_id,
   :tenant_id,
   1,
   'buyer',
   :offer_price_kobo,
   'Backfilled from pre-engine offer_price_kobo field',
   'pending',
   unixepoch(),
   NULL);
```

### 5. Write an audit entry

```sql
INSERT INTO negotiation_audit_log
  (id, tenant_id, session_id, event_type, actor_type,
   actor_ref_id, amount_kobo, metadata, created_at)
VALUES
  (lower(hex(randomblob(10))),
   :tenant_id,
   :session_id,
   'session_opened',
   'system',
   'backfill',
   :offer_price_kobo,
   '{"source":"pre_engine_backfill","listing_type":"used_car"}',
   unixepoch());
```

### 6. Clear the informal columns (optional, deferred)

After verifying the backfill is correct and the formal sessions are visible in the
seller dashboard, the informal columns can be cleared:

```sql
UPDATE used_car_dealer_listings
SET offer_price_kobo = NULL,
    status = 'active',
    updated_at = unixepoch()
WHERE status = 'negotiating'
  AND id = :listing_id;
```

**Do not remove the `offer_price_kobo` column** — it may still be used by existing
integrations. Clearing the value is sufficient.

## Spare Parts — Wholesale RFQ

The `listing_type` for spare parts negotiation sessions is `'spare_part'`.

Spare parts do not have an existing informal negotiation field. No backfill is required.
Sellers simply enable negotiation via `PUT /api/v1/negotiation/policy` and
`POST /api/v1/negotiation/listings/spare_part/:id/mode`.

## Logistics Delivery — Charter/Bulk Freight

The `listing_type` for logistics charter sessions is `'logistics_route'`.

Only `session_type = 'bulk_rfq'` or `'service_quote'` is permitted for logistics routes.
Standard per-parcel delivery remains fixed pricing.

The engine enforces this gate:
```typescript
// In engine.ts
if (requiresBulkOrServiceQuote(input.listing_type) && input.session_type === 'offer') {
  throw new InvalidSessionTypeForListingError(input.listing_type, input.session_type);
}
```

No backfill is required for logistics — no informal negotiation existed previously.
