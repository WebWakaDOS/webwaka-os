# TDR-0010: Offline and PWA Standard

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka's primary market — Nigeria and broader Africa — operates on mobile-heavy, variable-connectivity infrastructure. A platform that requires stable internet to function will exclude large portions of its intended user base.

## Decision

Offline-first and PWA-first are baseline platform requirements, not optional enhancements.

Every customer-facing app must:
- Be installable as a PWA (valid manifest, service worker, HTTPS)
- Support cached reads of recently accessed data during offline periods
- Queue write operations when offline and sync on reconnection
- Provide visible offline/online state indicators to users

## Scope

This requirement applies to: brand surfaces, partner admin, public discovery.

It does not apply to: internal API workers (which are server-side and cannot be offline).

## Consequences

- Service worker strategy must be chosen per app in Milestone 2 — Cache-first for static assets, Network-first with cache fallback for API responses
- Sync queue implementation lives in `packages/core` and is shared
- Tests must include an offline simulation scenario for all critical write paths
- CI includes a Lighthouse PWA score check — minimum score of 80 required to pass

---

## M7 Extension: Dexie.js + USSD Fallback

### Dexie.js as Offline Queue Engine

In Milestone 7, `packages/offline-sync` adopts **Dexie.js** as the IndexedDB abstraction layer for the offline write queue.

Rationale:
- Dexie.js provides a clean promise-based API over raw IndexedDB.
- Supports transactions, versioned schemas, and reactive queries.
- Works in all modern browsers and PWA service workers.

Queue schema:
```typescript
interface OfflineQueueItem {
  id: string;          // UUID
  operation: 'create' | 'update' | 'delete';
  entity: string;      // e.g. 'SocialPost', 'CommunityEvent'
  payload: unknown;
  tenant_id: string;
  created_at: number;  // Unix epoch
  attempts: number;    // Retry count
  last_error?: string;
}
```

Sync engine: Platform Invariant P11 — FIFO replay, server-wins conflict resolution, no silent drops.

### USSD Fallback (`apps/ussd-gateway`)

For users without smartphones or data connectivity, a USSD interface is required.

**Shortcode:** `*384#` (Waka code — pending NCC registration)

**USSD feature map:**
- `*384# → 1` — Check my wallet / balance
- `*384# → 2` — Send money (T1-T3 KYC gated)
- `*384# → 3` — Trending feed (top 5 posts by engagement)
- `*384# → 4` — Book transport seat
- `*384# → 5` — Community announcements

USSD sessions are stateless at the HTTP layer. Session state is stored in Cloudflare KV with 3-minute TTL.

Implementation: `apps/ussd-gateway` Worker — Africa's Talking USSD gateway integration.

See `docs/enhancements/m7/offline-sync.md` for full Dexie.js + sync spec.
