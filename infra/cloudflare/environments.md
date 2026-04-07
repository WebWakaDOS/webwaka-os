# Cloudflare Environments

**Status:** ✅ CONFIGURED — 2026-04-07
**Configured by:** Base44 Super Agent

---

## Environment Overview

| Environment | Purpose | Branch | Status |
|---|---|---|---|
| staging | Pre-production testing | `staging` | ✅ CREATED |
| production | Live platform | `main` | ✅ CREATED |

---

## Cloudflare Resources

### D1 Databases

| Name | Environment | Database ID | Status |
|---|---|---|---|
| webwaka-os-staging | staging | `cfa62668-bbd0-4cf2-996a-53da76bab948` | ✅ Created |
| webwaka-os-production | production | `de1d0935-31ed-4a33-a0fd-0122d7a4fe43` | ✅ Created |

> IDs stored as GitHub Actions secrets: `CLOUDFLARE_D1_STAGING_ID`, `CLOUDFLARE_D1_PRODUCTION_ID`

### KV Namespaces

| Name | Environment | Namespace ID | Purpose | Status |
|---|---|---|---|---|
| WEBWAKA_KV_STAGING | staging | `dd0fc527f4714275af996e77335b8aa8` | Tenant config, sessions | ✅ Created |
| WEBWAKA_KV_PRODUCTION | production | `9f7573b954d743d79ba7b37480f9af85` | Tenant config, sessions | ✅ Created |
| WEBWAKA_RATE_LIMIT_KV_STAGING | staging | `608eacac3eb941a68c716b14e84b4d10` | Rate limiting | ✅ Created |
| WEBWAKA_RATE_LIMIT_KV_PRODUCTION | production | `af260e847d1e400e94cf13f6ae3214eb` | Rate limiting | ✅ Created |

> IDs also set as GitHub environment variables: `KV_NAMESPACE_ID`, `RATE_LIMIT_KV_ID`

### R2 Buckets

| Name | Purpose | Status |
|---|---|---|
| webwaka-os-assets-staging | Tenant assets, documents (staging) | ✅ Created |
| webwaka-os-assets-production | Tenant assets, documents (production) | ✅ Created |

### Workers Projects

Workers will be created automatically on first `wrangler deploy` run.
The naming convention is: `webwaka-os-<app>-<env>`

| App | Worker Name (staging) | Worker Name (production) | Status |
|---|---|---|---|
| API | `webwaka-os-api-staging` | `webwaka-os-api-production` | Pending (Milestone 2) |
| Platform Admin | `webwaka-os-platform-admin-staging` | `webwaka-os-platform-admin-production` | Pending (Milestone 3) |
| Partner Admin | `webwaka-os-partner-admin-staging` | `webwaka-os-partner-admin-production` | Pending (Milestone 3) |
| Public Discovery | `webwaka-os-discovery-staging` | `webwaka-os-discovery-production` | Pending (Milestone 4) |
| Brand Runtime | `webwaka-os-brand-runtime-staging` | `webwaka-os-brand-runtime-production` | Pending (Milestone 6) |

---

## GitHub Actions Secrets (all set ✅)

| Secret Name | Status |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | ✅ Set |
| `CLOUDFLARE_API_TOKEN` | ✅ Set |
| `CLOUDFLARE_D1_STAGING_ID` | ✅ Set |
| `CLOUDFLARE_D1_PRODUCTION_ID` | ✅ Set |
| `JWT_SECRET_STAGING` | ✅ Set |
| `JWT_SECRET_PRODUCTION` | ✅ Set |
| `INTER_SERVICE_SECRET` | ✅ Set |

## GitHub Environment Variables (all set ✅)

| Variable | Environment | Value |
|---|---|---|
| `ENVIRONMENT` | staging | `staging` |
| `ENVIRONMENT` | production | `production` |
| `LOG_LEVEL` | staging | `debug` |
| `LOG_LEVEL` | production | `warn` |
| `KV_NAMESPACE_ID` | staging | `dd0fc527f4714275af996e77335b8aa8` |
| `KV_NAMESPACE_ID` | production | `9f7573b954d743d79ba7b37480f9af85` |
| `RATE_LIMIT_KV_ID` | staging | `608eacac3eb941a68c716b14e84b4d10` |
| `RATE_LIMIT_KV_ID` | production | `af260e847d1e400e94cf13f6ae3214eb` |

---

## DNS / Custom Domains

| Domain | Environment | Status |
|---|---|---|
| `api-staging.webwaka.com` | staging | NOT CONFIGURED — awaiting domain confirmation |
| `api.webwaka.com` | production | NOT CONFIGURED — awaiting domain confirmation |
| `admin-staging.webwaka.com` | staging | NOT CONFIGURED |
| `admin.webwaka.com` | production | NOT CONFIGURED |

To configure: provide Base44 with the DNS zone details, or confirm webwaka.com is managed in this Cloudflare account.
