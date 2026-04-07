# GitHub Actions Secrets Inventory

**Owner:** Base44 Super Agent
**Last updated:** 2026-04-07
**Status:** ✅ ALL SECRETS SET

This document records all GitHub Actions secrets and environment variables.
It contains NAMES and STATUS ONLY — never actual values.

---

## Repository Secrets

| Secret Name | Purpose | Status |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account for wrangler deploy | ✅ Set |
| `CLOUDFLARE_API_TOKEN` | API token (Workers + D1 + KV + R2 scope) | ✅ Set |

---

## Staging Environment Secrets

| Secret Name | Purpose | Status |
|---|---|---|
| `CLOUDFLARE_D1_STAGING_ID` | D1 database ID for staging | ✅ Set |
| `JWT_SECRET_STAGING` | JWT signing secret for staging | ✅ Set |
| `INTER_SERVICE_SECRET` | Shared secret for inter-service auth | ✅ Set |

---

## Production Environment Secrets

| Secret Name | Purpose | Status |
|---|---|---|
| `CLOUDFLARE_D1_PRODUCTION_ID` | D1 database ID for production | ✅ Set |
| `JWT_SECRET_PRODUCTION` | JWT signing secret for production | ✅ Set |
| `INTER_SERVICE_SECRET` | Shared secret for inter-service auth | ✅ Set |

---

## Environment Variables (non-secret)

| Variable | Environment | Value | Status |
|---|---|---|---|
| `ENVIRONMENT` | staging | `staging` | ✅ Set |
| `ENVIRONMENT` | production | `production` | ✅ Set |
| `LOG_LEVEL` | staging | `debug` | ✅ Set |
| `LOG_LEVEL` | production | `warn` | ✅ Set |
| `KV_NAMESPACE_ID` | staging | `dd0fc527...` | ✅ Set |
| `KV_NAMESPACE_ID` | production | `9f7573b9...` | ✅ Set |
| `RATE_LIMIT_KV_ID` | staging | `608eacac...` | ✅ Set |
| `RATE_LIMIT_KV_ID` | production | `af260e84...` | ✅ Set |

---

## Rotation Policy

All secrets must be rotated every 90 days or immediately on suspected exposure.
- Last set: 2026-04-07
- Next rotation due: 2026-07-07
