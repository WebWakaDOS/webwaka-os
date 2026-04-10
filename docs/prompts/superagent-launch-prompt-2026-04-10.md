# WebWaka OS — Super Admin Launch Prompt
## Superagent Execution Brief

**Document type:** Agent execution brief  
**Repo:** `https://github.com/WebWakaDOS/webwaka-os` (branch: `main`, HEAD `3f1478c`)  
**Reference checklist:** `docs/super-admin-launch-checklist.md`  
**Goal:** First working Super Admin login on staging → production live → operator using platform

---

## Context You Must Know Before Starting

The platform is code-complete (100/100 deployment readiness). Prior Superagents have:
- Fixed all TypeScript errors across 160+ verticals
- Created all 190 D1 migrations (0001–0190)
- Fixed all security issues (tenant isolation, P9 floats, NDPR erasure, rate-limit hardening)
- Wired real Cloudflare D1 UUIDs and KV namespace IDs into all 4 `wrangler.toml` files
- Created all KV namespaces in Cloudflare (GEOGRAPHY_CACHE, THEME_CACHE, DISCOVERY_CACHE, USSD_SESSION_KV, RATE_LIMIT_KV)

**What is NOT done yet** (your job):
- Wrangler secrets not set on staging or production Workers
- Migrations not yet applied to the remote D1 databases
- Geography seed data not loaded
- Super Admin user not created in the database
- Workers not deployed to Cloudflare
- Staging not verified
- Production not live

---

## Known Values (Use These Exactly — Do Not Change)

```
CLOUDFLARE_ACCOUNT_ID = a5f5864b726209519e0c361f2bb90e79
D1 staging database_name  = webwaka-os-staging
D1 staging database_id    = cfa62668-bbd0-4cf2-996a-53da76bab948
D1 production database_name = webwaka-os-production
D1 production database_id  = de1d0935-31ed-4a33-a0fd-0122d7a4fe43

Super Admin email      = admin@webwaka.ng
Super Admin user ID    = user_superadmin_001
Platform workspace ID  = ws_platform_001
Platform tenant ID     = tenant_webwaka
```

---

## Environment Variables Available to You

These are set in the environment where you are running:

| Variable | Used For |
|---|---|
| `CLOUDFLARE_API_TOKEN` | All `wrangler` commands (Workers, D1, KV, secrets) |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | git push + GitHub API (secrets, variables, environments) |

**Verify both are set before doing anything:**
```bash
echo "CF token chars: $(echo $CLOUDFLARE_API_TOKEN | wc -c)"
echo "GH token chars: $(echo $GITHUB_PERSONAL_ACCESS_TOKEN | wc -c)"
# Both must be > 1. If either is 0/1 — STOP and report to operator.
```

---

## Pre-Flight

```bash
# 1. Pull the latest code
git pull origin main

# 2. Confirm 0 TypeScript errors
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error TS" | wc -l
# Must print 0

# 3. Confirm wrangler can authenticate
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"
npx wrangler whoami
# Must show your account name — not an auth error

# 4. Install dependencies
pnpm install --frozen-lockfile
```

---

## Step 1 — Set All Wrangler Secrets on Staging

### 1A — Generate secrets you control autonomously

Run this Node.js block to generate all random secrets, then set each one:

```bash
# Generate all random secrets at once and print them
node -e "
const c = require('crypto');
const secrets = {
  JWT_SECRET:          c.randomBytes(48).toString('hex'),
  LOG_PII_SALT:        c.randomBytes(32).toString('hex'),
  DM_MASTER_KEY:       c.randomBytes(32).toString('hex'),
  PRICE_LOCK_SECRET:   c.randomBytes(32).toString('hex'),
  INTER_SERVICE_SECRET: c.randomBytes(32).toString('hex'),
};
Object.entries(secrets).forEach(([k,v]) => console.log(k + '=' + v));
" > /tmp/generated-secrets.txt

cat /tmp/generated-secrets.txt
```

Set each generated secret on the staging Worker:
```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

# Read the generated values and pipe them directly to wrangler
JWT_SECRET=$(grep JWT_SECRET /tmp/generated-secrets.txt | cut -d= -f2)
LOG_PII_SALT=$(grep LOG_PII_SALT /tmp/generated-secrets.txt | cut -d= -f2)
DM_MASTER_KEY=$(grep DM_MASTER_KEY /tmp/generated-secrets.txt | cut -d= -f2)
PRICE_LOCK_SECRET=$(grep PRICE_LOCK_SECRET /tmp/generated-secrets.txt | cut -d= -f2)
INTER_SERVICE_SECRET=$(grep INTER_SERVICE_SECRET /tmp/generated-secrets.txt | cut -d= -f2)

echo "$JWT_SECRET"          | npx wrangler secret put JWT_SECRET          --env staging --config apps/api/wrangler.toml
echo "$LOG_PII_SALT"        | npx wrangler secret put LOG_PII_SALT        --env staging --config apps/api/wrangler.toml
echo "$DM_MASTER_KEY"       | npx wrangler secret put DM_MASTER_KEY       --env staging --config apps/api/wrangler.toml
echo "$PRICE_LOCK_SECRET"   | npx wrangler secret put PRICE_LOCK_SECRET   --env staging --config apps/api/wrangler.toml
echo "$INTER_SERVICE_SECRET" | npx wrangler secret put INTER_SERVICE_SECRET --env staging --config apps/api/wrangler.toml

# Also set on ussd-gateway and brand-runtime Workers
echo "$JWT_SECRET"           | npx wrangler secret put JWT_SECRET           --env staging --config apps/ussd-gateway/wrangler.toml
echo "$INTER_SERVICE_SECRET" | npx wrangler secret put INTER_SERVICE_SECRET --env staging --config apps/ussd-gateway/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env staging --config apps/ussd-gateway/wrangler.toml
echo "$JWT_SECRET"           | npx wrangler secret put JWT_SECRET           --env staging --config apps/brand-runtime/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env staging --config apps/brand-runtime/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env staging --config apps/public-discovery/wrangler.toml
```

Save the generated secrets to `docs/staging-secrets-record.txt` (gitignored) so the operator has them:
```bash
echo "# Staging secrets — generated $(date) — DO NOT COMMIT" > docs/staging-secrets-record.txt
cat /tmp/generated-secrets.txt >> docs/staging-secrets-record.txt
echo "staging-secrets-record.txt" >> .gitignore
```

### 1B — Third-party API keys (check env, use staging-placeholder if absent)

For each of these, check if the environment variable is already set. If it is, pipe it. If not, use a `staging-not-configured` placeholder (staging will work for all non-payment routes):

```bash
set_secret_or_placeholder() {
  local secret_name=$1
  local env_var_name=$2
  local config=$3
  local env=$4
  local value="${!env_var_name}"
  if [ -z "$value" ]; then
    value="staging-not-configured-$(echo $secret_name | tr '[:upper:]' '[:lower:]')"
    echo "[WARN] $secret_name not found in env — setting placeholder. Set real value before going live."
  fi
  echo "$value" | npx wrangler secret put "$secret_name" --env "$env" --config "$config"
}

# API Worker secrets
set_secret_or_placeholder PAYSTACK_SECRET_KEY      PAYSTACK_SECRET_KEY      apps/api/wrangler.toml       staging
set_secret_or_placeholder PREMBLY_API_KEY          PREMBLY_API_KEY          apps/api/wrangler.toml       staging
set_secret_or_placeholder TERMII_API_KEY           TERMII_API_KEY           apps/api/wrangler.toml       staging
set_secret_or_placeholder WHATSAPP_ACCESS_TOKEN    WHATSAPP_ACCESS_TOKEN    apps/api/wrangler.toml       staging
set_secret_or_placeholder WHATSAPP_PHONE_NUMBER_ID WHATSAPP_PHONE_NUMBER_ID apps/api/wrangler.toml       staging
set_secret_or_placeholder TELEGRAM_BOT_TOKEN       TELEGRAM_BOT_TOKEN       apps/api/wrangler.toml       staging

# USSD Gateway secrets
set_secret_or_placeholder AFRICAS_TALKING_USERNAME AFRICAS_TALKING_USERNAME apps/ussd-gateway/wrangler.toml staging
set_secret_or_placeholder AFRICAS_TALKING_API_KEY  AFRICAS_TALKING_API_KEY  apps/ussd-gateway/wrangler.toml staging
```

**Verify secrets were accepted:**
```bash
npx wrangler secret list --env staging --config apps/api/wrangler.toml
# Must list: JWT_SECRET, LOG_PII_SALT, DM_MASTER_KEY, PRICE_LOCK_SECRET, INTER_SERVICE_SECRET,
#            PAYSTACK_SECRET_KEY, PREMBLY_API_KEY, TERMII_API_KEY, WHATSAPP_ACCESS_TOKEN,
#            WHATSAPP_PHONE_NUMBER_ID, TELEGRAM_BOT_TOKEN
```

---

## Step 2 — Apply All 190 Migrations to Staging D1

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

npx wrangler d1 migrations apply webwaka-os-staging \
  --env staging \
  --config apps/api/wrangler.toml \
  --remote 2>&1 | tee /tmp/migrations-staging-output.txt

# Check the output — must NOT contain "Error" or "failed"
grep -i "error\|fail" /tmp/migrations-staging-output.txt | grep -v "IF NOT EXISTS" | wc -l
# Must be 0

# Verify all 8 previously-missing tables now exist
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN (
    'search_entries','discovery_events','vendor_pricing_policies',
    'listing_price_overrides','negotiation_sessions','negotiation_offers',
    'negotiation_audit_log','ministry_members'
  ) ORDER BY name;" 2>&1
# Must return 8 rows

# Also verify migration 0190 applied (users table has the new columns)
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --command "SELECT name FROM pragma_table_info('users') WHERE name IN ('workspace_id','tenant_id','role');" 2>&1
# Must return 3 rows
```

---

## Step 3 — Load Nigeria Geography Seed Data

Load in this exact order (each file depends on the previous):

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

for seed_file in \
  "infra/db/seed/nigeria_country.sql" \
  "infra/db/seed/nigeria_zones.sql" \
  "infra/db/seed/nigeria_states.sql" \
  "infra/db/seed/0002_lgas.sql" \
  "infra/db/seed/0003_wards.sql"
do
  echo "=== Loading $seed_file ==="
  npx wrangler d1 execute webwaka-os-staging --env staging --remote \
    --config apps/api/wrangler.toml \
    --file "$seed_file" 2>&1
  echo "Done: $seed_file"
done

# Verify geography loaded
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --command "SELECT geography_type, COUNT(*) as count FROM places GROUP BY geography_type ORDER BY geography_type;" 2>&1
# Expected: country=1, geopolitical_zone=6, state=36, local_government_area=774 (at minimum)
```

---

## Step 4 — Generate Super Admin Password Hash and Seed the Database

### 4A — Generate a fresh PBKDF2 password hash for staging

The password for staging Super Admin is: `WebWaka@2026!`

Generate a fresh hash (never reuse the one in the checklist document — it was published):

```bash
node -e "
const c = require('crypto').webcrypto;
const encoder = new TextEncoder();
const password = 'WebWaka@2026!';

const saltBytes = c.getRandomValues(new Uint8Array(16));
const saltB64 = btoa(String.fromCharCode(...saltBytes));

c.subtle.importKey('raw', encoder.encode(password), {name:'PBKDF2'}, false, ['deriveBits'])
  .then(key => c.subtle.deriveBits(
    {name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256'},
    key,
    256
  ))
  .then(bits => {
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
    const hash = saltB64 + ':' + hashB64;
    console.log('STAGING_ADMIN_HASH=' + hash);
    require('fs').writeFileSync('/tmp/admin-hash.txt', hash);
  });
" && sleep 1 && ADMIN_HASH=$(cat /tmp/admin-hash.txt) && echo "Hash generated: ${ADMIN_HASH:0:20}..."
```

### 4B — Write and apply the seed SQL

```bash
ADMIN_HASH=$(cat /tmp/admin-hash.txt)

cat > /tmp/seed-super-admin.sql << ENDSQL
-- WebWaka OS — Platform Super Admin Seed (staging)
-- Generated: $(date)

INSERT OR IGNORE INTO workspaces (
  id, tenant_id, name, owner_type, owner_id,
  subscription_plan, subscription_status, active_layers
) VALUES (
  'ws_platform_001',
  'tenant_webwaka',
  'WebWaka Platform',
  'organization',
  'user_superadmin_001',
  'enterprise',
  'active',
  '["discovery","commerce","social","community","civic","identity","payments"]'
);

INSERT OR IGNORE INTO users (
  id, email, full_name, password_hash,
  workspace_id, tenant_id, role, kyc_status, kyc_tier
) VALUES (
  'user_superadmin_001',
  'admin@webwaka.ng',
  'WebWaka Super Admin',
  '${ADMIN_HASH}',
  'ws_platform_001',
  'tenant_webwaka',
  'super_admin',
  'verified',
  't3'
);

INSERT OR IGNORE INTO memberships (
  id, workspace_id, tenant_id, user_id, role
) VALUES (
  'mbr_superadmin_001',
  'ws_platform_001',
  'tenant_webwaka',
  'user_superadmin_001',
  'super_admin'
);
ENDSQL

# Apply to staging D1
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --file /tmp/seed-super-admin.sql 2>&1

# Verify all 3 rows were inserted
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --command "SELECT id, email, role, tenant_id FROM users WHERE email='admin@webwaka.ng';" 2>&1
# Must return 1 row with role=super_admin

npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --command "SELECT id, name, subscription_plan FROM workspaces WHERE id='ws_platform_001';" 2>&1
# Must return 1 row

npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --config apps/api/wrangler.toml \
  --command "SELECT id, role FROM memberships WHERE user_id='user_superadmin_001';" 2>&1
# Must return 1 row with role=super_admin
```

---

## Step 5 — Deploy All 4 Workers to Staging

Deploy in this order (API first, then the supporting Workers):

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

echo "=== Deploying API Worker ===" && \
  npx wrangler deploy --env staging --config apps/api/wrangler.toml 2>&1 | tee /tmp/deploy-api.txt

echo "=== Deploying Brand Runtime Worker ===" && \
  npx wrangler deploy --env staging --config apps/brand-runtime/wrangler.toml 2>&1 | tee /tmp/deploy-brand.txt

echo "=== Deploying Public Discovery Worker ===" && \
  npx wrangler deploy --env staging --config apps/public-discovery/wrangler.toml 2>&1 | tee /tmp/deploy-discovery.txt

echo "=== Deploying USSD Gateway Worker ===" && \
  npx wrangler deploy --env staging --config apps/ussd-gateway/wrangler.toml 2>&1 | tee /tmp/deploy-ussd.txt

# Extract the deployed API URL (you'll need it for verification)
grep -o "https://[^ ]*workers\.dev" /tmp/deploy-api.txt | head -1 > /tmp/staging-api-url.txt
STAGING_URL=$(cat /tmp/staging-api-url.txt)
echo "=== Staging API URL: $STAGING_URL ==="
# Save it — you will use it in Step 6 and need to record it for CI
```

**If any Worker deploy fails:**
- Check output for error message
- Most common: missing secret → re-run Step 1 for that secret
- Type errors in the Worker: run `npx tsc --noEmit -p apps/api/tsconfig.json` — must be 0 errors

---

## Step 6 — Verify Staging (Health + Login + Smoke)

```bash
STAGING_URL=$(cat /tmp/staging-api-url.txt)
echo "Testing: $STAGING_URL"

# Health probe
echo "=== GET /health ===" && \
  curl -sf "$STAGING_URL/health" | jq . && echo "PASS"

# Version endpoint
echo "=== GET /health/version ===" && \
  curl -sf "$STAGING_URL/health/version" | jq . && echo "PASS"

# Super Admin login
echo "=== POST /auth/login ===" && \
  TOKEN=$(curl -sf -X POST "$STAGING_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@webwaka.ng","password":"WebWaka@2026!"}' | jq -r '.token') && \
  echo "Token obtained: ${TOKEN:0:30}..." && echo "PASS"

# Verify identity from JWT
echo "=== GET /auth/me ===" && \
  curl -sf "$STAGING_URL/auth/me" \
    -H "Authorization: Bearer $TOKEN" | jq . && echo "PASS"

# Confirm role is super_admin
ROLE=$(curl -sf "$STAGING_URL/auth/me" -H "Authorization: Bearer $TOKEN" | jq -r '.data.role')
echo "Role: $ROLE"
[ "$ROLE" = "super_admin" ] && echo "SUPER ADMIN VERIFIED ✓" || echo "ERROR: unexpected role $ROLE"
```

**If login returns 401 or 500:**
- Check the users table: `wrangler d1 execute` → `SELECT * FROM users WHERE email='admin@webwaka.ng';`
- Check migration 0190 applied: `SELECT name FROM pragma_table_info('users') WHERE name='role';`
- Check JWT_SECRET is set: `wrangler secret list --env staging --config apps/api/wrangler.toml | grep JWT_SECRET`

**If login returns "no such column":**
- Migration 0190 did not apply. Run manually:
  ```bash
  npx wrangler d1 execute webwaka-os-staging --env staging --remote \
    --config apps/api/wrangler.toml \
    --command "ALTER TABLE users ADD COLUMN workspace_id TEXT; ALTER TABLE users ADD COLUMN tenant_id TEXT; ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';"
  ```
  Then re-run Step 4B to seed the user again.

---

## Step 7 — Wire GitHub Actions for CI/CD

The CI pipeline needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets, plus `STAGING_BASE_URL` and `PRODUCTION_BASE_URL` as GitHub Actions variables. Set them via the GitHub API:

```bash
STAGING_URL=$(cat /tmp/staging-api-url.txt)
GH_REPO="WebWakaDOS/webwaka-os"
GH_API="https://api.github.com/repos/${GH_REPO}"
GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"

# Helper: encrypt a secret for GitHub Actions using the repo public key
set_gh_secret() {
  local secret_name=$1
  local secret_value=$2

  # Get the repo public key
  KEY_RESPONSE=$(curl -sf -H "Authorization: Bearer $GH_TOKEN" \
    "$GH_API/actions/secrets/public-key")
  KEY_ID=$(echo "$KEY_RESPONSE" | jq -r '.key_id')
  KEY=$(echo "$KEY_RESPONSE" | jq -r '.key')

  # Encrypt using Node.js (libsodium-wrappers is not always available — use simple base64 wrapper)
  # GitHub requires libsodium encryption. Use gh CLI if available, else document manual step.
  if command -v gh &> /dev/null; then
    echo "$secret_value" | gh secret set "$secret_name" --repo "$GH_REPO"
    echo "Set secret $secret_name via gh CLI"
  else
    echo "[MANUAL REQUIRED] Set GitHub secret $secret_name at:"
    echo "https://github.com/$GH_REPO/settings/secrets/actions"
    echo "Value: (use the value from your environment — do not print)"
  fi
}

# Set GitHub Actions variables (these are not secrets — just configuration values)
set_gh_var() {
  local var_name=$1
  local var_value=$2
  curl -sf -X POST \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$GH_API/actions/variables" \
    -d "{\"name\":\"$var_name\",\"value\":\"$var_value\"}" 2>&1 | head -1 || \
  curl -sf -X PATCH \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$GH_API/actions/variables/$var_name" \
    -d "{\"name\":\"$var_name\",\"value\":\"$var_value\"}" 2>&1 | head -1
  echo "Set variable $var_name = $var_value"
}

# Set CI variables (public — safe to print)
set_gh_var "STAGING_BASE_URL"    "$STAGING_URL"
set_gh_var "PRODUCTION_BASE_URL" "https://api.webwaka.ng"

# Set secrets (use gh CLI if available)
set_gh_secret "CLOUDFLARE_ACCOUNT_ID" "a5f5864b726209519e0c361f2bb90e79"
set_gh_secret "CLOUDFLARE_API_TOKEN"  "$CLOUDFLARE_API_TOKEN"

# Report what needs to be done manually if gh CLI is not available
echo ""
echo "=== GitHub Secrets Manual Setup (if gh CLI not available) ==="
echo "Go to: https://github.com/$GH_REPO/settings/secrets/actions"
echo "Add secret: CLOUDFLARE_ACCOUNT_ID = a5f5864b726209519e0c361f2bb90e79"
echo "Add secret: CLOUDFLARE_API_TOKEN = <your token from \$CLOUDFLARE_API_TOKEN>"
```

---

## Step 8 — Enable Production Approval Gate (Document for Operator)

**This step requires a human to click in the GitHub UI — you cannot automate it.**

However, create the GitHub environment via API (the protection rule click must be done manually):

```bash
GH_REPO="WebWakaDOS/webwaka-os"
GH_API="https://api.github.com/repos/${GH_REPO}"
GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"

# Create the production environment (if it doesn't exist)
curl -sf -X PUT \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "$GH_API/environments/production" \
  -d '{"wait_timer":0}' 2>&1

# Create the staging environment (if it doesn't exist)
curl -sf -X PUT \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "$GH_API/environments/staging" \
  -d '{"wait_timer":0}' 2>&1

echo ""
echo "============================================================"
echo "MANUAL ACTION REQUIRED — Operator must do this in GitHub UI:"
echo "============================================================"
echo ""
echo "1. Go to: https://github.com/$GH_REPO/settings/environments"
echo "2. Click 'production'"
echo "3. Enable 'Required reviewers'"
echo "4. Add your GitHub username as a reviewer"
echo "5. Save"
echo ""
echo "This ensures no push to main auto-ships to production without"
echo "a manual click. Do this BEFORE triggering the production deploy."
echo "============================================================"
```

Write this instruction to a file the operator will see:
```bash
cat > /tmp/operator-manual-steps.txt << 'EOF'
OPERATOR MANUAL STEPS — Complete before Step 9

1. GITHUB PRODUCTION APPROVAL GATE:
   URL: https://github.com/WebWakaDOS/webwaka-os/settings/environments
   - Click "production" environment
   - Enable "Required reviewers"
   - Add your GitHub username
   - Save
   (Without this, production deploys on every push to main without approval)

2. PRODUCTION SECRETS:
   After Step 9 CI runs, you must set real third-party API keys on production:
   - PAYSTACK_SECRET_KEY  (live key, not test key)
   - PREMBLY_API_KEY
   - TERMII_API_KEY
   - WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID
   - TELEGRAM_BOT_TOKEN
   - AFRICAS_TALKING_USERNAME + AFRICAS_TALKING_API_KEY
   Command: echo "VALUE" | npx wrangler secret put SECRET_NAME --env production --config apps/api/wrangler.toml

3. PRODUCTION SUPER ADMIN PASSWORD:
   After production migrations apply, generate a NEW password hash (not WebWaka@2026!)
   for the production super admin seed.
   DO NOT use the staging password on production.
EOF
cat /tmp/operator-manual-steps.txt
```

---

## Step 9 — Trigger Production CI Pipeline

### 9A — Set production secrets first

Set the same randomly-generated secrets on production (use the same values as staging for internal secrets — they are symmetric):

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

JWT_SECRET=$(grep JWT_SECRET /tmp/generated-secrets.txt | cut -d= -f2)
LOG_PII_SALT=$(grep LOG_PII_SALT /tmp/generated-secrets.txt | cut -d= -f2)
DM_MASTER_KEY=$(grep DM_MASTER_KEY /tmp/generated-secrets.txt | cut -d= -f2)
PRICE_LOCK_SECRET=$(grep PRICE_LOCK_SECRET /tmp/generated-secrets.txt | cut -d= -f2)
INTER_SERVICE_SECRET=$(grep INTER_SERVICE_SECRET /tmp/generated-secrets.txt | cut -d= -f2)

echo "$JWT_SECRET"           | npx wrangler secret put JWT_SECRET           --env production --config apps/api/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env production --config apps/api/wrangler.toml
echo "$DM_MASTER_KEY"        | npx wrangler secret put DM_MASTER_KEY        --env production --config apps/api/wrangler.toml
echo "$PRICE_LOCK_SECRET"    | npx wrangler secret put PRICE_LOCK_SECRET    --env production --config apps/api/wrangler.toml
echo "$INTER_SERVICE_SECRET" | npx wrangler secret put INTER_SERVICE_SECRET --env production --config apps/api/wrangler.toml
echo "$JWT_SECRET"           | npx wrangler secret put JWT_SECRET           --env production --config apps/ussd-gateway/wrangler.toml
echo "$INTER_SERVICE_SECRET" | npx wrangler secret put INTER_SERVICE_SECRET --env production --config apps/ussd-gateway/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env production --config apps/ussd-gateway/wrangler.toml
echo "$JWT_SECRET"           | npx wrangler secret put JWT_SECRET           --env production --config apps/brand-runtime/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env production --config apps/brand-runtime/wrangler.toml
echo "$LOG_PII_SALT"         | npx wrangler secret put LOG_PII_SALT         --env production --config apps/public-discovery/wrangler.toml

# Third-party production secrets (placeholders until operator replaces them)
for secret in PAYSTACK_SECRET_KEY PREMBLY_API_KEY TERMII_API_KEY WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID TELEGRAM_BOT_TOKEN; do
  val="${!secret:-production-not-configured-$(echo $secret | tr '[:upper:]' '[:lower:]')}"
  echo "$val" | npx wrangler secret put "$secret" --env production --config apps/api/wrangler.toml
done
echo "staging-not-configured-at-username" | npx wrangler secret put AFRICAS_TALKING_USERNAME --env production --config apps/ussd-gateway/wrangler.toml
echo "staging-not-configured-at-apikey"   | npx wrangler secret put AFRICAS_TALKING_API_KEY  --env production --config apps/ussd-gateway/wrangler.toml
```

### 9B — Seed production Super Admin

Generate a **different** production password hash:

```bash
PROD_PASSWORD="WebWaka@Prod2026!"  # use a strong unique production password

node -e "
const c = require('crypto').webcrypto;
const encoder = new TextEncoder();
const password = process.env.PROD_PASSWORD;

const saltBytes = c.getRandomValues(new Uint8Array(16));
const saltB64 = btoa(String.fromCharCode(...saltBytes));

c.subtle.importKey('raw', encoder.encode(password), {name:'PBKDF2'}, false, ['deriveBits'])
  .then(key => c.subtle.deriveBits({name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256'}, key, 256))
  .then(bits => {
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
    require('fs').writeFileSync('/tmp/prod-admin-hash.txt', saltB64 + ':' + hashB64);
    console.log('Production hash generated');
  });
" PROD_PASSWORD="$PROD_PASSWORD" && sleep 1

PROD_ADMIN_HASH=$(cat /tmp/prod-admin-hash.txt)

cat > /tmp/seed-super-admin-prod.sql << ENDSQL
INSERT OR IGNORE INTO workspaces (
  id, tenant_id, name, owner_type, owner_id,
  subscription_plan, subscription_status, active_layers
) VALUES (
  'ws_platform_001',
  'tenant_webwaka',
  'WebWaka Platform',
  'organization',
  'user_superadmin_001',
  'enterprise',
  'active',
  '["discovery","commerce","social","community","civic","identity","payments"]'
);

INSERT OR IGNORE INTO users (
  id, email, full_name, password_hash,
  workspace_id, tenant_id, role, kyc_status, kyc_tier
) VALUES (
  'user_superadmin_001',
  'admin@webwaka.ng',
  'WebWaka Super Admin',
  '${PROD_ADMIN_HASH}',
  'ws_platform_001',
  'tenant_webwaka',
  'super_admin',
  'verified',
  't3'
);

INSERT OR IGNORE INTO memberships (
  id, workspace_id, tenant_id, user_id, role
) VALUES (
  'mbr_superadmin_001',
  'ws_platform_001',
  'tenant_webwaka',
  'user_superadmin_001',
  'super_admin'
);
ENDSQL

npx wrangler d1 execute webwaka-os-production --env production --remote \
  --config apps/api/wrangler.toml \
  --file /tmp/seed-super-admin-prod.sql 2>&1

echo "Production password: $PROD_PASSWORD" > /tmp/prod-credentials.txt
echo "STORE THIS SECURELY — do not commit or share via chat"
cat /tmp/prod-credentials.txt
```

### 9C — Also apply geography seeds to production

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

for seed_file in \
  "infra/db/seed/nigeria_country.sql" \
  "infra/db/seed/nigeria_zones.sql" \
  "infra/db/seed/nigeria_states.sql" \
  "infra/db/seed/0002_lgas.sql" \
  "infra/db/seed/0003_wards.sql"
do
  echo "=== Loading $seed_file to production ===" && \
  npx wrangler d1 execute webwaka-os-production --env production --remote \
    --config apps/api/wrangler.toml \
    --file "$seed_file" 2>&1
done
```

### 9D — Push to main to trigger the production CI pipeline

```bash
git remote set-url origin "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/WebWakaDOS/webwaka-os.git"

# Add any uncommitted files (e.g., .gitignore update for staging-secrets-record.txt)
git add .gitignore 2>/dev/null || true
git diff --staged --quiet || git commit -m "ops: update .gitignore for staging secrets record"

# The current HEAD should be 3f1478c with all remediation work
# Just push — CI triggers automatically
git push origin main 2>&1 | tail -5

# Reset to secure remote URL
git remote set-url origin "https://github.com/WebWakaDOS/webwaka-os.git"

echo ""
echo "=== CI Pipeline Triggered ==="
echo "Monitor at: https://github.com/WebWakaDOS/webwaka-os/actions"
echo ""
echo "The pipeline will:"
echo "  1. Run TypeScript check (should pass — 0 errors confirmed)"
echo "  2. Run tests"
echo "  3. Apply migrations 0001–0190 to production D1"
echo "  4. PAUSE for operator approval (if OPS-001 protection gate is set)"
echo "  5. Deploy all 4 Workers to production after approval"
echo "  6. Run smoke tests against production"
echo ""
echo "OPERATOR: Go to https://github.com/WebWakaDOS/webwaka-os/actions"
echo "and click APPROVE on the 'Deploy API (Production)' job when ready."
```

---

## Final Verification Checklist

Run after production CI completes and operator approves production deploy:

```bash
PROD_URL="https://api.webwaka.ng"

echo "=== Production Health ===" && \
  curl -sf "$PROD_URL/health" | jq .

echo "=== Production Version ===" && \
  curl -sf "$PROD_URL/health/version" | jq .

echo "=== Production Login ===" && \
  PROD_TOKEN=$(curl -sf -X POST "$PROD_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"admin@webwaka.ng\",\"password\":\"$(cat /tmp/prod-credentials.txt | grep password | cut -d: -f2 | xargs)\"}" \
    | jq -r '.token') && \
  echo "Token: ${PROD_TOKEN:0:30}..."

echo "=== Production Identity ===" && \
  curl -sf "$PROD_URL/auth/me" \
    -H "Authorization: Bearer $PROD_TOKEN" | jq .data.role
# Must print: "super_admin"
```

---

## Summary of What You Must Deliver

At the end of execution, all of the following must be true:

| Check | Verification |
|---|---|
| Staging deployed | `curl https://<staging-url>/health` → `{"status":"ok"}` |
| Staging login works | `POST /auth/login` → JWT with `role: "super_admin"` |
| Staging geography loaded | `SELECT COUNT(*) FROM places` → ≥ 817 rows |
| Production migrations applied | CI output shows "Applied N migrations" |
| Production deployed | `curl https://api.webwaka.ng/health` → `{"status":"ok"}` |
| Production login works | `POST /auth/login` → JWT with `role: "super_admin"` |
| CI pipeline green | All jobs green at `/actions` except pending human approval |
| Operator instructions delivered | `/tmp/operator-manual-steps.txt` printed to output |
| Staging secrets record | `docs/staging-secrets-record.txt` written (gitignored) |

**Do not stop until all checks pass or you have a clear error message explaining the blocker.**

---

*End of Superagent Launch Brief — WebWaka OS — 2026-04-10*
