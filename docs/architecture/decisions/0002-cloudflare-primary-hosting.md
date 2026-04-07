# TDR-0002: Cloudflare as Primary Hosting Platform

**Status:** APPROVED
**Approval owner:** Founder
**Author:** Base44 Super Agent (validated)
**Date:** 2026-04-07
**Supersedes:** —
**Superseded by:** —

---

## Context

WebWaka OS serves users across Nigeria and Africa, many of whom are on mobile connections with variable latency. The platform requires a hosting solution that is:
- Low-latency globally and specifically within West Africa
- Cost-effective for a startup-scale product
- Capable of running TypeScript/JavaScript at the edge
- Integrated with database, caching, storage, and queue primitives
- Deployable via GitHub Actions CI/CD
- Scalable without infrastructure management overhead

Several platforms were considered: traditional VPS/cloud (AWS, GCP), Vercel, Netlify, Fly.io, and Cloudflare Workers.

---

## Decision

**Use Cloudflare Workers as the primary production runtime.**

Supporting Cloudflare services in use:
- **D1** — SQLite-based relational database at the edge
- **KV** — Key-value store for tenant config, sessions, rate limits
- **R2** — Object storage for documents and assets
- **Queues** — Event bus for async processing (commerce events, etc.)
- **Pages** — Static/PWA frontend deployment where applicable

---

## Consequences

### Positive
- Edge execution gives sub-100ms latency for most African users via Cloudflare's global PoP network
- Workers are stateless — no server management, automatic scaling
- D1 + KV + R2 keeps all infrastructure within Cloudflare — no cross-provider latency
- GitHub → Cloudflare deployment is natively supported via `wrangler` and GitHub Actions
- Cost model is consumption-based — very low at early stage
- `nodejs_compat` flag allows most Node.js APIs

### Negative / Constraints
- Workers have a CPU time limit (50ms on free, 30s on paid) — long-running operations need queue offloading
- D1 is SQLite — no stored procedures, limited analytical queries
- No persistent in-memory state between requests
- Cold starts exist but are typically <5ms on Workers

### Mitigations
- Long operations (reports, exports, bulk processing) go through Cloudflare Queues
- Complex analytics use aggregated materialized views in D1 or a separate analytics layer
- All state is externalised to D1/KV (no reliance on in-process memory)

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| AWS Lambda + RDS | Higher latency in Africa, operational overhead, cost at scale |
| Fly.io | Good option but requires container management; less edge-native |
| Vercel + PlanetScale | Frontend-focused; Workers is better fit for API-first architecture |
| Netlify | Similar to Vercel — not optimal for Workers-first design |

---

## Validation

Base44 Super Agent has validated:
- `wrangler.toml` patterns across existing WebWaka repos
- D1 database connectivity and migration patterns
- KV namespace patterns for tenant config
- GitHub Actions → Cloudflare deploy pipeline via `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
- `nodejs_compat` flag is required and applied to all repos
