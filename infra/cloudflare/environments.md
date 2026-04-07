# Cloudflare Environments

> **Status:** AWAITING SETUP — Cloudflare credentials required from Founder.
> Once credentials are provided, Base44 Super Agent will create all resources and update this document.

---

## Environment Overview

| Environment | Purpose | Branch | Status |
|---|---|---|---|
| staging | Pre-production testing | `staging` | NOT CREATED |
| production | Live platform | `main` | NOT CREATED |

---

## Required Cloudflare Resources

### Workers Projects
| App | Worker Name (staging) | Worker Name (production) |
|---|---|---|
| API | `webwaka-os-api-staging` | `webwaka-os-api-production` |
| Platform Admin | `webwaka-os-platform-admin-staging` | `webwaka-os-platform-admin-production` |
| Partner Admin | `webwaka-os-partner-admin-staging` | `webwaka-os-partner-admin-production` |
| Public Discovery | `webwaka-os-discovery-staging` | `webwaka-os-discovery-production` |
| Brand Runtime | `webwaka-os-brand-runtime-staging` | `webwaka-os-brand-runtime-production` |

### D1 Databases
| Name | Environment | Database ID | Status |
|---|---|---|---|
| webwaka-os-staging | staging | `[TO BE CREATED]` | NOT CREATED |
| webwaka-os-production | production | `[TO BE CREATED]` | NOT CREATED |

> D1 IDs are stored in GitHub Actions secrets: `CLOUDFLARE_D1_STAGING_ID`, `CLOUDFLARE_D1_PRODUCTION_ID`
> They are also referenced in `wrangler.toml` via environment variable substitution — never hardcoded.

### KV Namespaces
| Name | Environment | Namespace ID | Status |
|---|---|---|---|
| WEBWAKA_KV_STAGING | staging | `[TO BE CREATED]` | NOT CREATED |
| WEBWAKA_KV_PRODUCTION | production | `[TO BE CREATED]` | NOT CREATED |

### R2 Buckets
| Name | Purpose | Status |
|---|---|---|
| webwaka-os-assets-staging | Tenant assets, documents (staging) | NOT CREATED |
| webwaka-os-assets-production | Tenant assets, documents (production) | NOT CREATED |

---

## GitHub Actions Secrets Required

The following secrets must be added to the repo before CI/CD can deploy:

| Secret Name | Value Source | Status |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Account ID | NOT SET |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → API Tokens → Create token (Workers:Edit, D1:Edit) | NOT SET |
| `CLOUDFLARE_D1_STAGING_ID` | Created by Base44 after Cloudflare setup | NOT SET |
| `CLOUDFLARE_D1_PRODUCTION_ID` | Created by Base44 after Cloudflare setup | NOT SET |
| `JWT_SECRET_STAGING` | Generated random 64-char hex | NOT SET |
| `JWT_SECRET_PRODUCTION` | Generated random 64-char hex | NOT SET |
| `INTER_SERVICE_SECRET` | Generated random 64-char hex | NOT SET |

**IMPORTANT:** Secrets are never stored in this file. Only their names and status.

---

## GitHub Actions Environment Variables (non-secret)

| Variable | Environment | Value |
|---|---|---|
| `STAGING_BASE_URL` | staging | `https://api-staging.webwaka.com` (TBD) |
| `PRODUCTION_BASE_URL` | production | `https://api.webwaka.com` (TBD) |

---

## DNS / Custom Domains

| Domain | Environment | Points To | Status |
|---|---|---|---|
| `api-staging.webwaka.com` | staging | Cloudflare Worker | NOT CONFIGURED |
| `api.webwaka.com` | production | Cloudflare Worker | NOT CONFIGURED |
| `admin-staging.webwaka.com` | staging | Cloudflare Worker | NOT CONFIGURED |
| `admin.webwaka.com` | production | Cloudflare Worker | NOT CONFIGURED |

Domains to be configured by Base44 after Cloudflare credentials are provided and DNS zones are confirmed.

---

## Setup Instructions for Founder

To unblock Cloudflare setup, please provide Base44 Super Agent with:

1. **Cloudflare Account ID** — found in the Cloudflare dashboard right sidebar
2. **Cloudflare API Token** — create at dash.cloudflare.com → My Profile → API Tokens
   - Use the "Edit Cloudflare Workers" template as a base
   - Add: `D1:Edit`, `Workers KV Storage:Edit`, `R2:Edit` permissions
   - Scope to the WebWaka account only
3. **Domain confirmation** — confirm the domain(s) for the platform (e.g. webwaka.com)

Once provided, Base44 will complete the full Cloudflare environment setup.
