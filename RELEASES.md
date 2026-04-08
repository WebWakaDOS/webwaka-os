# Release Process

> Full policy: `docs/governance/release-governance.md`

## Environments

| Environment | Branch | Deployment | Approval |
|---|---|---|---|
| Staging | `staging` | Automatic on merge | Auto |
| Production | `main` | Automatic on merge to `main` | Founder signoff required |

## Promotion Flow

```
feat/* branch
  → PR to staging
  → CI passes
  → Code review
  → Merge to staging
  → Staging CI deploys to Cloudflare staging
  → QA verification
  → Founder staging signoff
  → PR from staging to main
  → Merge to main
  → CI deploys to Cloudflare production
```

## Rollback

- Revert the merge commit and push to `main` — CI will redeploy the previous version
- For D1 migrations: each migration must be reversible; rollback scripts live in `infra/cloudflare/migrations/`

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Tags are created on every production release: `v1.0.0`, `v1.1.0`, etc.
- Changelog maintained in `CHANGELOG.md` (generated from commit history)

## Release Checklist

Before promoting to production:
- [ ] All CI checks pass on `staging`
- [ ] Governance alignment verified
- [ ] Tenant isolation verified
- [ ] Entitlement enforcement verified
- [ ] Geography correctness verified
- [ ] Mobile QA passed
- [ ] Staging deploy successful
- [ ] Founder signoff received
- [ ] Rollback plan documented

---

## Release History

### M7b — Offline Sync + USSD Gateway + POS Float Ledger
- **Date:** 2026-04-08
- **PR:** #24 | **SHA:** `ef76fdc`
- **QA:** Replit Agent QA | 178/178 tests · 0 typecheck errors | Approved + Merged
- **Deliverables:** D1 migrations 0022–0025, `@webwaka/offline-sync` (Dexie.js + SyncEngine + SW), `apps/ussd-gateway` (Hono Worker + KV FSM + *384#), `@webwaka/pos` (double-entry float ledger), 6 POS API routes + `POST /sync/apply`
- **Compliance:** P6, P9, P11, T3, T4
- **QA Fixes:** 4 — `@webwaka/pos` alias (vitest+tsconfig), migration 0025 `client_id` UNIQUE, migration 0025 `status` spec
- **QA Report:** `docs/qa/m7b-qa-report.md`
- **Release Notes:** `docs/milestones/m7b-release-notes.md`

### M7a — Regulatory Survival + Multi-Channel Contact
- **Date:** 2026-04-08
- **PR:** #21 | **SHA:** `d629339`
- **QA:** Base44 Super Agent | Score: 25/25 | Approved
- **Deliverables:** 9 migrations, 15 package files (@webwaka/identity + @webwaka/otp + @webwaka/contact), CBN KYC tiers, 9 API routes, 2 middleware, 116 tests
- **Compliance:** P10 P12 P13 R5 R6 R7 R8 R9 R10
- **Release Notes:** `docs/milestones/m7a-release-notes.md`

### M6 — Payments + Frontend + Events
- **Date:** 2026-04-07
- **PR:** #17 | Merged to main
- **QA:** Base44 Super Agent | Approved

### M5 — Claim-First Onboarding MVP
- **PR:** #16 | Merged to main

### M4 — Discovery Layer MVP
- **PR:** #14 | Merged to main

### M3 — Vertical Scaffolding + API
- **PR:** #13

### M2 — Core Package Scaffold
- **PR:** #10 | Merged

### M1 — Governance Baseline
- **PR:** #6 | Merged
