# Cloudflare Setup Checklist

**Owner:** Base44 Super Agent
**Status:** ✅ COMPLETE — 2026-04-07

---

## Pre-requisites

- [x] Founder provided Cloudflare Account ID: `a5f5864b726209519e0c361f2bb90e79`
- [x] Founder provided Cloudflare API Token (Workers:Edit + D1:Edit + KV:Edit + R2:Edit)
- [ ] Founder confirms domain(s) for the platform — PENDING

---

## Step 1: Create D1 Databases ✅

- [x] webwaka-os-staging created — ID: `cfa62668-bbd0-4cf2-996a-53da76bab948`
- [x] webwaka-os-production created — ID: `de1d0935-31ed-4a33-a0fd-0122d7a4fe43`
- [x] D1 IDs stored as GitHub Actions secrets

---

## Step 2: Create KV Namespaces ✅

- [x] WEBWAKA_KV_STAGING created — ID: `dd0fc527f4714275af996e77335b8aa8`
- [x] WEBWAKA_KV_PRODUCTION created — ID: `9f7573b954d743d79ba7b37480f9af85`
- [x] WEBWAKA_RATE_LIMIT_KV_STAGING created — ID: `608eacac3eb941a68c716b14e84b4d10`
- [x] WEBWAKA_RATE_LIMIT_KV_PRODUCTION created — ID: `af260e847d1e400e94cf13f6ae3214eb`

---

## Step 3: Create R2 Buckets ✅

- [x] webwaka-os-assets-staging created
- [x] webwaka-os-assets-production created

---

## Step 4: Store GitHub Actions Secrets ✅

- [x] CLOUDFLARE_ACCOUNT_ID
- [x] CLOUDFLARE_API_TOKEN
- [x] CLOUDFLARE_D1_STAGING_ID
- [x] CLOUDFLARE_D1_PRODUCTION_ID
- [x] JWT_SECRET_STAGING (generated: openssl rand -hex 32)
- [x] JWT_SECRET_PRODUCTION (generated: openssl rand -hex 32)
- [x] INTER_SERVICE_SECRET (generated: openssl rand -hex 32)

---

## Step 5: Configure GitHub Environment Variables ✅

**staging environment:**
- [x] ENVIRONMENT = staging
- [x] LOG_LEVEL = debug
- [x] KV_NAMESPACE_ID = dd0fc527f4714275af996e77335b8aa8
- [x] RATE_LIMIT_KV_ID = 608eacac3eb941a68c716b14e84b4d10

**production environment:**
- [x] ENVIRONMENT = production
- [x] LOG_LEVEL = warn
- [x] KV_NAMESPACE_ID = 9f7573b954d743d79ba7b37480f9af85
- [x] RATE_LIMIT_KV_ID = af260e847d1e400e94cf13f6ae3214eb

---

## Step 6: Configure Custom Domains ⏳

- [ ] DNS zone verified in Cloudflare — PENDING domain confirmation from Founder
- [ ] Staging custom domain configured
- [ ] Production custom domain configured

To complete: confirm which domain(s) you own and whether they are already in this Cloudflare account.

---

## Step 7: docs/governance/milestone-tracker.md updated ✅

Cloudflare setup marked DONE in milestone tracker.
