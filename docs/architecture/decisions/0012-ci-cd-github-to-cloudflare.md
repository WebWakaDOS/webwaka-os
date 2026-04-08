# TDR-0012: CI/CD Pipeline — GitHub Actions to Cloudflare

**Status:** ACTIVE
**Approval owner:** Base44 Super Agent (infrastructure) + Founder (approval)
**Author:** Base44 Super Agent
**Date:** 2026-04-07
**Supersedes:** —
**Superseded by:** —

---

## Context

WebWaka OS needs a reliable, auditable CI/CD pipeline that:
- Runs checks on every PR (typecheck, tests, lint, security audit)
- Deploys to Cloudflare staging automatically on merge to `staging`
- Deploys to Cloudflare production automatically on merge to `main`
- Prevents broken code reaching any environment
- Is resumable and understandable by any agent or developer

---

## Decision

**Use GitHub Actions as the CI/CD orchestrator, deploying to Cloudflare via `wrangler deploy`.**

### Pipeline Architecture

```
PR opened/updated
  → ci.yml
      ├── typecheck (tsc --noEmit)
      ├── test (vitest run)
      ├── lint (eslint)
      ├── audit (npm audit --audit-level=high)
      └── check-core-version (verify @webwaka/core pin)

Merge to staging
  → deploy-staging.yml
      ├── run CI checks
      └── wrangler deploy --env staging (all apps)

Merge to main
  → deploy-production.yml
      ├── run CI checks
      ├── wrangler deploy --env production (all apps)
      └── post-deploy smoke test
```

### Required GitHub Actions Secrets

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account |
| `CLOUDFLARE_API_TOKEN` | Token with Workers:Edit, D1:Edit scope |
| `CLOUDFLARE_D1_STAGING_ID` | Staging D1 database ID |
| `CLOUDFLARE_D1_PRODUCTION_ID` | Production D1 database ID |

### Workflow Files

| File | Trigger | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | PR to any protected branch | Run all checks |
| `.github/workflows/deploy-staging.yml` | Push to `staging` | Deploy to Cloudflare staging |
| `.github/workflows/deploy-production.yml` | Push to `main` | Deploy to Cloudflare production |
| `.github/workflows/check-core-version.yml` | PR touching package.json | Verify @webwaka/core version |

---

## Consequences

### Positive
- Single source of truth for deployment — all deploys are traceable to GitHub commits
- Automatic staging deployment removes manual steps
- Production deployment is gated behind all CI checks
- Cloudflare's native GitHub integration (via `wrangler`) is well-supported

### Negative / Constraints
- Cloudflare API token must be kept fresh and has minimal scope
- Workers deploy times can be 30–60 seconds for large bundles
- D1 migrations are NOT run automatically — they require a separate manual/workflow step before deploy

### Migration Strategy
D1 migrations are applied in a separate step before app deployment:
```
wrangler d1 migrations apply webwaka-os-staging --env staging
wrangler d1 migrations apply webwaka-os-production --env production
```
Migration workflow will be added separately as `deploy-migrations.yml`.

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Cloudflare Pages native deployment | Works for frontends but not Workers API deployments |
| Manual `wrangler deploy` | Not auditable, not reproducible, human error risk |
| Other CI providers (CircleCI, Travis) | GitHub Actions is already integrated — no reason to add another provider |

---

> **M7 Cross-Reference 2026-04-08:** Reviewed by Base44 Super Agent — no conflicts with M7 additions. New packages (identity, otp, community, social) and apps/ussd-gateway conform to all decisions in this TDR.
