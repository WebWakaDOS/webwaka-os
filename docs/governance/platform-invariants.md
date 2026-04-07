# Platform Invariants

**Status:** ACTIVE — REQUIRES FOUNDER APPROVAL BEFORE MODIFICATION
**Owner:** Base44 Super Agent (initial) → Perplexity (refinement) → Founder (approval)
**Last updated:** 2026-04-07

---

## Purpose

These are the non-negotiable technical and product rules for WebWaka OS. They cannot be overridden by any individual feature, team, or agent. Changing an invariant requires a new TDR and explicit Founder approval.

---

## Core Product Invariants

### P1 — Build Once Use Infinitely
Every capability is implemented as a reusable, parameterised primitive. Vertical-specific code must compose from shared packages. Duplicating a shared capability in a vertical module is not allowed.

### P2 — Nigeria First
All UX flows, payment integrations, compliance rules, and data models are designed first for Nigerian regulatory and market realities. Internationalisation is a subsequent layer, never the primary concern.

### P3 — Africa First
After Nigeria, the next expansion target is Africa. No architectural decisions may lock the platform to a single country or jurisdiction at the data or runtime layer.

### P4 — Mobile First
Every interface is designed for a 360px viewport first. Desktop is an enhancement. No feature ships without mobile layout verification.

### P5 — PWA First
All client-facing apps are Progressive Web Apps: installable, manifest-equipped, and service-worker-enabled. App store distribution is secondary.

### P6 — Offline First
Core user journeys (browsing, creating records, submitting forms) must function without a network connection. Writes are queued offline and synced on reconnect. The sync model must handle conflicts deterministically.

### P7 — Vendor Neutral AI
AI capabilities are routed through a provider abstraction layer. No direct SDK calls to OpenAI, Anthropic, or any other provider in business logic. Provider selection is configuration, not code.

### P8 — BYOK Capable
Every AI-consuming feature supports Bring Your Own Key. Tenants can supply their own API keys and have them used transparently by the platform.

---

## Technical Invariants

### T1 — Cloudflare-First Runtime
The production runtime is Cloudflare Workers. No server-based runtimes (Node.js HTTP servers, Express, etc.) in the production deployment path. Local dev may use Node.js shims.

### T2 — TypeScript-First
All packages and apps are written in TypeScript. `any` types require a comment explaining why. No untyped JS files in `packages/` or `apps/`.

### T3 — Tenant Isolation Everywhere
Every database query on tenant-scoped data includes a `tenant_id` predicate. Every KV key for tenant data is prefixed with `tenant:{tenant_id}:`. Every R2 path for tenant assets is prefixed with `{tenant_id}/`. Cross-tenant queries exist only in super admin contexts and are explicitly marked.

### T4 — Monetary Integrity
All monetary values are stored and processed as **integer kobo** (NGN × 100). Floating point arithmetic is not used for money. Display formatting is a presentation concern only.

### T5 — Subscription-Gated Features
Every non-public feature access is checked against the tenant's active subscription entitlements. Entitlement checks use `@packages/entitlements` — no hardcoded plan checks in feature code.

### T6 — Geography-Driven Discovery
Discovery pages, inventory rollups, and marketplace aggregation are driven by the geography hierarchy from `@packages/geography`. Direct city/state string matching is not used for aggregation.

### T7 — Claim-First Growth
Discoverable entities (businesses, professionals, properties, routes, etc.) are seeded first and claimed later. The claim → verify → manage lifecycle is enforced by `@packages/profiles`.

### T8 — Step-by-Step GitHub Commits
All changes are committed in small, coherent units. No mega-commits spanning multiple features. Every commit must pass CI.

### T9 — No Skipped Phases
Shared foundation packages must be built before vertical-specific features that depend on them. Milestones are sequential. No skipping.

### T10 — Continuity-Friendly Code
Every file, function, and module must be readable and resumable by a new agent or developer with no prior context. Inline comments are required for non-obvious logic. No magic strings.

---

## Enforcement

Violations of any invariant are treated as blocking issues:
- **Product invariants (P1–P8):** Founder review required before any exception
- **Technical invariants (T1–T10):** Base44 blocks merge; issue opened with `governance` + `blocked` labels

To propose an exception, open an issue using the **Architecture Decision** template.
