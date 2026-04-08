# Release Governance

**Status:** ACTIVE
**Owner:** Base44 Super Agent (draft) → Founder (approval)
**Last updated:** 2026-04-07

---

> **M7 Review 2026-04-08:** Reviewed by Base44 Super Agent — no structural changes required. KYC/NDPR/Community/Social references are additive layers in entitlement-model.md and universal-entity-model.md.


## Purpose

This document defines the rules for promoting code from development to staging to production. No exceptions without explicit Founder approval.

---

## Environments

| Environment | Branch | URL Pattern | Deployment Trigger |
|---|---|---|---|
| Development | `feat/*`, `fix/*` | Local / Wrangler dev | Manual |
| Staging | `staging` | `staging.webwaka.com` (or workers.dev) | Auto on merge to `staging` |
| Production | `main` | `app.webwaka.com` | Auto on merge to `main` |

---

## Promotion Flow

```
feat/* or fix/* branch
  ↓ PR to staging (CI must pass, 1 review required)
  ↓ Merge to staging
  ↓ Automated deploy to Cloudflare staging
  ↓ QA verification (Base44 runs governance checks)
  ↓ Founder staging signoff (required)
  ↓ PR from staging → main (no additional code changes allowed)
  ↓ Merge to main
  ↓ Automated deploy to Cloudflare production
```

---

## Rules

### Staging Promotion Rules
1. All CI checks must pass (typecheck, test, lint, security audit).
2. At least 1 reviewer must approve the PR.
3. No unresolved review comments.
4. PR description must reference the milestone and related issues.
5. No direct pushes to `staging` (exception: Base44 automation with PAT for infrastructure-only files — must be documented).

### Production Promotion Rules
1. All staging rules apply.
2. **Founder must explicitly sign off on staging before a PR to `main` is opened.**
3. The staging → main PR must be a clean merge with no cherry-picks or manual rebases.
4. Production deployment must be observed and confirmed within 30 minutes.
5. Post-deploy smoke test must pass (see `tests/smoke/`).

---

## Rollback Policy

### Code Rollback
- Revert the merge commit on `main` (`git revert -m 1 <merge-sha>`).
- Push to `main` — CI will automatically redeploy the previous version.
- Rollback must be announced in the incident channel.

### Database Rollback
- Every D1 migration in `infra/cloudflare/migrations/` must include a corresponding rollback script.
- Naming convention: `NNNN_description.sql` (forward) and `NNNN_description.rollback.sql` (reverse).
- Rollback is applied manually using `wrangler d1 execute`.
- **No migration may drop a column or table in the same release it was first added.** Add → use → drop across separate releases.

---

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR:** breaking changes (schema changes affecting existing tenants, API contract changes)
- **MINOR:** new features, new packages, new endpoints
- **PATCH:** bug fixes, performance improvements, doc updates
- Every production release is tagged: `v1.2.3`
- Changelog auto-generated from conventional commits

---

## Approval Matrix

| Action | Approver |
|---|---|
| Merge feat to staging | 1 reviewer (any) |
| Merge staging to main | Founder signoff required |
| Emergency hotfix to main | Founder verbal + Base44 executes |
| Rollback production | Base44 executes, Founder notified immediately |
| Schema migration to production | Founder must review migration script |

---

## Milestone Release Criteria

Before a milestone is marked DONE and promoted to `main`:
- [ ] All milestone tasks completed and verified
- [ ] CI passes on `staging`
- [ ] Governance alignment verified by Base44
- [ ] Tenant isolation verified
- [ ] Entitlement enforcement verified
- [ ] Geography correctness verified
- [ ] Mobile QA passed
- [ ] Staging smoke tests pass
- [ ] Rollback plan documented
- [ ] Founder signoff received
