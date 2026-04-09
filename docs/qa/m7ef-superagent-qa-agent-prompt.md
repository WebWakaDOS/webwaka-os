# WebWaka OS — Expert QA Agent Prompt
## M7e + M7f + M7 QA Gate + SuperAgent Master Plan

**Date:** 2026-04-09  
**Repository:** https://github.com/WebWakaDOS/webwaka-os  
**Branch:** `feat/m7ef-nigeria-ux-contact`  
**PR:** #27 → `main`  
**Authority:** This prompt supersedes all prior QA briefs for this milestone.  
**Your mandate:** Fix every issue found. Push fixes. Merge to `main`. Leave zero open items.

---

## 0. Mission

You are an expert QA engineer and senior TypeScript developer. Your job is to:

1. Audit every M7e, M7f, M7 QA Gate, and SuperAgent deliverable against the spec below
2. Fix every code, documentation, or configuration issue you find — do not merely report them
3. Confirm `pnpm -r typecheck` produces **0 errors** and `pnpm -r test` produces **≥ 771 tests passing**
4. Push all fixes to `feat/m7ef-nigeria-ux-contact` on GitHub
5. Approve and merge PR #27 to `main`
6. Confirm `main` is clean and pull the merged commit

You have full authority to edit any file in the workspace. Every issue is either **fixed before you finish** or **explicitly documented as an approved exception** with a justification comment.

---

## 1. Environment Setup

```bash
# Confirm you are on the correct branch
git branch --show-current
# Expected: feat/m7ef-nigeria-ux-contact

# Confirm Node and pnpm versions
node --version   # 20.x or 22.x
pnpm --version   # 9.x or 10.x

# Install dependencies
pnpm install

# Baseline confirmation — run BEFORE any changes
pnpm -r typecheck    # Must be: 0 errors
pnpm -r test         # Must be: ≥ 771 tests passing
```

If baseline fails, diagnose and fix before proceeding.

---

## 2. Housekeeping — Fix First

### 2.1 Remove the auto-committed asset file

The Replit checkpoint auto-committed a stray file that must not be in the PR:

```bash
# Check if it exists
ls attached_assets/

# If present, remove it from git tracking
git rm -r attached_assets/ 2>/dev/null || true
git commit -m "chore: remove auto-committed attached_assets from branch" 2>/dev/null || true
```

### 2.2 Confirm .gitignore covers attached_assets

```bash
grep "attached_assets" .gitignore || echo "attached_assets/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore attached_assets directory" 2>/dev/null || true
```

---

## 3. M7ef Implementation Audit

### 3.1 File Existence Checklist

Confirm every file below exists and is non-empty:

```bash
# M7e
test -s apps/api/src/routes/airtime.ts           && echo "OK" || echo "MISSING: airtime.ts"
test -s apps/api/src/routes/airtime.test.ts      && echo "OK" || echo "MISSING: airtime.test.ts"
test -s apps/api/src/routes/geography.ts         && echo "OK" || echo "MISSING: geography.ts"
test -s apps/api/src/routes/geography.test.ts    && echo "OK" || echo "MISSING: geography.test.ts"
test -s apps/api/src/middleware/low-data.ts      && echo "OK" || echo "MISSING: low-data.ts"
test -s apps/api/src/routes/low-data.test.ts     && echo "OK" || echo "MISSING: low-data.test.ts"
test -s packages/frontend/src/i18n/pcm.ts        && echo "OK" || echo "MISSING: pcm.ts"
test -s packages/frontend/src/i18n/en.ts         && echo "OK" || echo "MISSING: en.ts"
test -s packages/frontend/src/i18n/index.ts      && echo "OK" || echo "MISSING: i18n/index.ts"
test -s packages/frontend/src/i18n/types.ts      && echo "OK" || echo "MISSING: i18n/types.ts"
test -s packages/frontend/src/ussd-shortcode.ts  && echo "OK" || echo "MISSING: ussd-shortcode.ts"
test -s apps/platform-admin/public/manifest.json && echo "OK" || echo "MISSING: manifest.json"
test -s apps/platform-admin/public/sw.js         && echo "OK" || echo "MISSING: sw.js"
# M7f
test -s infra/db/migrations/0035_contact_telegram_chat_id.sql && echo "OK" || echo "MISSING: migration 0035"
test -s packages/contact/src/contact-service.ts  && echo "OK" || echo "MISSING: contact-service.ts"
test -s packages/contact/src/contact-service.test.ts && echo "OK" || echo "MISSING: contact-service.test.ts"
test -s packages/auth/src/guards.ts              && echo "OK" || echo "MISSING: guards.ts"
test -s apps/ussd-gateway/src/telegram.ts        && echo "OK" || echo "MISSING: telegram.ts"
test -s apps/ussd-gateway/src/telegram.test.ts   && echo "OK" || echo "MISSING: telegram.test.ts"
# QA Gate docs
test -s docs/qa/nitda-self-assessment.md         && echo "OK" || echo "MISSING: nitda-self-assessment.md"
test -s docs/qa/cbn-kyc-audit.md                 && echo "OK" || echo "MISSING: cbn-kyc-audit.md"
test -s docs/qa/ndpr-consent-audit.md            && echo "OK" || echo "MISSING: ndpr-consent-audit.md"
test -s docs/qa/security-review-m7.md            && echo "OK" || echo "MISSING: security-review-m7.md"
# SuperAgent docs
test -s docs/governance/superagent/01-synthesis-report.md   && echo "OK" || echo "MISSING"
test -s docs/governance/superagent/02-product-spec.md       && echo "OK" || echo "MISSING"
test -s docs/governance/superagent/03-system-architecture.md && echo "OK" || echo "MISSING"
test -s docs/governance/superagent/04-execution-roadmap.md  && echo "OK" || echo "MISSING"
test -s docs/governance/superagent/05-document-update-plan.md && echo "OK" || echo "MISSING"
test -s docs/governance/superagent/06-governance-rules.md   && echo "OK" || echo "MISSING"
```

Any `MISSING` result is a P0 blocker. Implement the missing file before proceeding.

### 3.2 Test Count Minimums

Per `docs/qa/m7ef-qa-brief.md`, these test counts are non-negotiable:

| Package / App | Minimum Tests | Verify Command |
|---|---|---|
| `apps/api` (airtime route) | ≥ 8 | `grep -c "it(" apps/api/src/routes/airtime.test.ts` |
| `apps/api` (geography route) | ≥ 5 | `grep -c "it(" apps/api/src/routes/geography.test.ts` |
| `packages/frontend` (i18n) | ≥ 4 | `grep -c "it(" packages/frontend/src/i18n.test.ts 2>/dev/null || grep -rl "i18n\|pcm\|ussd" packages/frontend/src/*.test.ts` |
| `apps/api` (low-data) | ≥ 3 | `grep -c "it(" apps/api/src/routes/low-data.test.ts` |
| `packages/contact` (contact-service) | ≥ 10 | `grep -c "it(" packages/contact/src/contact-service.test.ts` |
| `apps/ussd-gateway` (telegram) | ≥ 5 | `grep -c "it(" apps/ussd-gateway/src/telegram.test.ts` |
| `apps/api` (integration) | ≥ 6 | `grep -c "it(" apps/api/src/routes/integration.test.ts` |
| `apps/api` (pos-reconciliation) | ≥ 3 | `grep -c "it(" apps/api/src/routes/pos-reconciliation.test.ts` |

If any count is below minimum, write the missing tests. Tests must cover:
- Happy path
- Auth failure (401)
- Invalid input (400/422)
- Edge cases specific to each feature

---

## 4. Platform Invariant Grep Checks

Run every check below. Any `grep` that finds a violation must be fixed.

```bash
# P7 — No direct AI SDK imports anywhere in source (not tests)
grep -r "from 'openai'" packages/ apps/ --include="*.ts" | grep -v ".test.ts" | grep -v "node_modules"
grep -r "from '@anthropic-ai" packages/ apps/ --include="*.ts" | grep -v ".test.ts"
grep -r "fetch.*api\.openai\.com" packages/ apps/ --include="*.ts" | grep -v ".test.ts" | grep -v "openai-compat"
# Expected: 0 matches. Any match = P7 violation.

# T2 — No untyped `any` without explanatory comment
grep -rn "as any$\|: any;" packages/ apps/ --include="*.ts" | grep -v "// " | grep -v ".test.ts"
# Expected: 0 matches.

# T3 — Tenant isolation: every new D1 route must bind tenantId
grep -n "prepare(" apps/api/src/routes/airtime.ts | head -5
grep -n "tenantId\|tenant_id" apps/api/src/routes/airtime.ts
# Expected: tenantId present in every query

grep -n "tenantId\|tenant_id" apps/api/src/routes/geography.ts
# Expected: tenantId present in all write queries (reads of geography data may be global)

# T4/P9 — No float arithmetic on monetary values
grep -rn "parseFloat\|toFixed\|amount_kobo.*\.\|\.0\b" apps/api/src/routes/airtime.ts
# Expected: 0 matches

# P10/P12 — Consent check before every outbound OTP
grep -n "assertChannelConsent\|consent_records" packages/contact/src/contact-service.ts
# Expected: assertChannelConsent() called before any send path

# P13 — Primary phone gate
grep -n "assertPrimaryPhoneVerified\|primary_phone" packages/contact/src/contact-service.ts
grep -n "assertPrimaryPhoneVerified\|requireKYCTier\|requirePrimaryPhone" packages/auth/src/guards.ts
# Expected: both guards present and exported

# P2 — Nigerian phone validation on airtime route
grep -n "validateNigerianPhone" apps/api/src/routes/airtime.ts
# Expected: called before any Termii API call

# G1/G2 (SuperAgent) — No platform env vars for direct vendor keys
grep -n "OPENAI_API_KEY\|ANTHROPIC_API_KEY\|GOOGLE_AI_API_KEY" apps/api/src/env.ts
# Expected: 0 matches. Aggregator keys only.
```

---

## 5. Known Issues — Investigate and Fix Each

The following issues were identified in prior reviews but not confirmed as fixed. Audit each one and fix if still present.

### Issue 1: `openai.ts` references in documentation

Three governance docs may reference `openai.ts` when the correct file is `openai-compat.ts` (the OpenAI-compatible adapter that serves all providers). Grep and correct:

```bash
grep -rn "openai\.ts\b" docs/ --include="*.md"
# For each match: replace "openai.ts" with "openai-compat.ts"
```

### Issue 2: `model_tier` CHECK constraint missing values

In `docs/governance/superagent/03-system-architecture.md` (or any migration referencing `model_tier`), the CHECK constraint should include all valid tiers including `multilingual` and `reasoning`. Verify:

```bash
grep -n "model_tier\|CHECK.*tier" docs/governance/superagent/03-system-architecture.md
grep -rn "model_tier" infra/db/migrations/ --include="*.sql"
```

If the CHECK constraint is:
```sql
CHECK (model_tier IN ('fast', 'standard', 'premium'))
```
It must be updated to:
```sql
CHECK (model_tier IN ('fast', 'standard', 'premium', 'multilingual', 'reasoning'))
```

Fix in all migration files and doc references.

### Issue 3: `ai-provider-routing.md` missing `consent_records` references

```bash
cat docs/ai/ai-provider-routing.md 2>/dev/null | grep -n "consent_records\|P10\|NDPR"
# If 0 matches: add a section noting that P10 (NDPR consent) applies to AI-generated
# outbound communications (e.g. AI-drafted OTPs, AI-generated messages)
# and that consent_records must exist before any AI-generated content is sent via contact channels.
```

### Issue 4: ADL-008/009 ordering

```bash
cat docs/governance/ai-architecture-decision-log.md 2>/dev/null | grep -n "^## ADL-00[89]"
# Confirm ADL-008 precedes ADL-009 in the document (sequential ordering).
# If reversed, reorder the sections.
```

### Issue 5: Incomplete env vars in SuperAgent architecture doc

Check `docs/governance/superagent/03-system-architecture.md` for the platform env vars section:

```bash
grep -A 20 "Platform Env\|env.ts\|wrangler" docs/governance/superagent/03-system-architecture.md | head -30
```

Confirm all 6 required vars are listed:
- `OPENROUTER_API_KEY_1` + `OPENROUTER_API_KEY_2`
- `TOGETHER_API_KEY_1`
- `GROQ_API_KEY_1`
- `EDEN_AI_KEY_1`
- `SA_KEY_ENCRYPTION_KEY`
- `SA_KEY_KV` (KV namespace binding)

Add any missing ones with their purpose and `wrangler secret put` command.

### Issue 6: Missing aggregator integration tests in SuperAgent docs

`docs/governance/superagent/03-system-architecture.md` must specify that the routing engine requires integration tests for each aggregator. Check:

```bash
grep -n "aggregator.*test\|integration.*test\|openrouter.*test" docs/governance/superagent/03-system-architecture.md
```

If not present, add a **Testing Requirements** section specifying that `packages/superagent-sdk` (when implemented in Phase 1) must include:
- OpenRouter connectivity test
- Together AI connectivity test
- Groq connectivity test
- Eden AI connectivity test
- WakaCU deduction test (mock D1)
- Key resolution chain test (BYOK → workspace BYOK → SuperAgent managed key)

---

## 6. Code Quality Checks

### 6.1 TypeScript strict compliance

```bash
pnpm -r typecheck
# Required: 0 errors. Zero tolerance.
```

If errors found, fix them. Common patterns already established in this codebase:
- Mock typing: `type MockPrepareFn = D1Like['prepare'] & { mock: { calls: unknown[][] } }`
- Define `D1Like` locally in every file (never import shared one)
- Use `vi.fn(impl) as unknown as MockPrepareFn` not `vi.fn().mockImplementation(impl)`

### 6.2 Full test suite

```bash
pnpm -r test 2>&1 | grep -E "Tests.*passed|Tests.*failed|FAIL"
# Required: ≥ 771 tests passed, 0 failed
```

Report the full count per package. If any package shows failures, diagnose and fix.

### 6.3 Dead code / unused imports

```bash
# Check for unused imports in new M7e/M7f files
pnpm --filter @webwaka/api lint 2>&1 | head -30
pnpm --filter @webwaka/contact lint 2>&1 | head -30
pnpm --filter @webwaka/social lint 2>&1 | head -30
```

Fix any lint errors in files modified or created in this milestone.

---

## 7. SuperAgent Docs Consistency Audit

Review all 6 SuperAgent docs as a set. Verify internal consistency:

### 7.1 Cross-reference check

| Claim in one doc | Where it must appear | Check |
|---|---|---|
| `sk-waka-{32 hex}` key format | 02-product-spec.md + 03-system-architecture.md | Both must agree |
| ₦1.50/WC retail pricing | 02-product-spec.md | Match scratchpad |
| ₦1.00/WC bulk (100K pack) | 02-product-spec.md | Match scratchpad |
| ₦0.60/WC wholesale (partner) | 02-product-spec.md | Match scratchpad |
| 4 aggregators: OpenRouter, Together, Groq, Eden AI | 03-system-architecture.md + 06-governance-rules.md | Must match |
| ADL-010 = aggregator-only | 03-system-architecture.md | Must be present and numbered correctly |
| Migration 0042 = `superagent_keys` | 03-system-architecture.md | Correct table name |
| Migration 0043 = `wc_wallets` + `wc_transactions` | 03-system-architecture.md | Both tables |
| Migration 0044 = `partner_credit_pools` | 03-system-architecture.md | Correct table name |

For any inconsistency, fix the doc that has the wrong value.

### 7.2 Governance rule numbering

```bash
grep "^## Rule G[0-9]" docs/governance/superagent/06-governance-rules.md
# Rules must be G1 through G10, sequential, no gaps
```

### 7.3 Execution roadmap phase numbering

```bash
grep "^## Phase\|^### SA-" docs/governance/superagent/04-execution-roadmap.md | head -20
# Phases must be 1–4, tasks must be SA-1.1 through SA-4.x, sequential
```

---

## 8. QA Gate Documents Audit

Open each of the 4 QA Gate docs and verify they are substantive (not placeholders):

```bash
wc -l docs/qa/nitda-self-assessment.md docs/qa/cbn-kyc-audit.md \
       docs/qa/ndpr-consent-audit.md docs/qa/security-review-m7.md
# Each file should be > 40 lines
```

For each doc, verify it addresses:

**nitda-self-assessment.md**: NITDA's Nigerian IT regulations compliance checklist — data localisation, local personnel, accessibility.

**cbn-kyc-audit.md**: CBN KYC Tier definitions (Tier 0/1/2/3), transaction limits per tier, BVN/NIN verification flow, how WebWaka enforces tier gates.

**ndpr-consent-audit.md**: NDPR Article-by-Article mapping, consent capture points (registration, channel add, OTP send), data retention policy, right-to-erasure implementation.

**security-review-m7.md**: M7e/M7f threat model, auth guards, rate limiting coverage, D1 injection surface, Telegram webhook secret validation, encryption-at-rest (P14 DM AES-256-GCM).

If any doc is missing required sections, add them.

---

## 9. GitHub Push and Merge

### 9.1 Commit all fixes

After completing all fixes:

```bash
git add -A
git status  # Review everything staged — no surprises

# Commit with descriptive message
git commit -m "fix(qa): M7ef + SuperAgent QA pass — invariant fixes, doc consistency, cleanup

- Remove attached_assets stray file (Replit checkpoint artifact)
- Fix [list specific issues fixed in this pass]
- Verify 771+ tests passing, 0 typecheck errors"
```

### 9.2 Push to remote

```bash
git remote set-url origin "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/WebWakaDOS/webwaka-os"
git push origin feat/m7ef-nigeria-ux-contact
git remote set-url origin "https://github.com/WebWakaDOS/webwaka-os"
```

### 9.3 Approve and merge PR #27

```bash
TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"

# Approve the PR
curl -s -X POST \
  "https://api.github.com/repos/WebWakaDOS/webwaka-os/pulls/27/reviews" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"APPROVE","body":"QA pass complete. All invariants verified. 771+ tests passing. 0 typecheck errors. Approved for merge."}' \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print('Review:', r.get('state', r.get('message')))"

# Merge the PR (squash merge to keep main history clean)
curl -s -X PUT \
  "https://api.github.com/repos/WebWakaDOS/webwaka-os/pulls/27/merge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commit_title": "feat(m7ef): M7e Nigeria UX + M7f Contact Layer + SuperAgent master plan (#27)",
    "commit_message": "Squash merge of feat/m7ef-nigeria-ux-contact:\n- M7e: Airtime top-up, Geography API, Pidgin i18n, Low-data middleware, USSD shortcode, PWA\n- M7f: ContactService (P12/P13), Auth guards, Telegram webhook, 360dialog OTP, Migration 0035\n- M7 QA Gate: NITDA, CBN KYC, NDPR, Security review docs\n- SuperAgent master plan: 6-document suite (ADL-010, WakaCU pricing, 4-aggregator architecture)\n- Typecheck fixes: community + social mock typing, SocialPost unification, DOM lib\n- 771 tests passing, 0 typecheck errors",
    "merge_method": "squash"
  }' \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print('Merge:', r.get('merged'), r.get('sha','')[:8], r.get('message',''))"
```

### 9.4 Pull main and confirm

```bash
git checkout main
git pull origin main
git log --oneline -3
# Confirm the squash commit appears as HEAD on main
```

### 9.5 If merge fails due to conflicts

```bash
# Rebase the branch on main first
git checkout feat/m7ef-nigeria-ux-contact
git fetch origin main
git rebase origin/main

# Resolve any conflicts, then force-push
git remote set-url origin "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/WebWakaDOS/webwaka-os"
git push origin feat/m7ef-nigeria-ux-contact --force-with-lease
git remote set-url origin "https://github.com/WebWakaDOS/webwaka-os"

# Then retry the merge API call above
```

---

## 10. Final Verification Checklist

Before declaring the task complete, confirm every item:

- [ ] `pnpm -r typecheck` — **0 errors**
- [ ] `pnpm -r test` — **≥ 771 tests, 0 failures**
- [ ] All 30+ M7ef files exist and are non-empty
- [ ] All 6 SuperAgent docs exist and are internally consistent
- [ ] All 4 QA Gate docs are substantive (> 40 lines each)
- [ ] No P7 violation (no direct AI SDK imports in non-test source)
- [ ] No T4 violation (no `parseFloat` / `toFixed` on monetary values)
- [ ] No `attached_assets/` directory in the repo
- [ ] `airtime.ts` — `tenantId` bound in all D1 queries
- [ ] `contact-service.ts` — `assertChannelConsent()` before every OTP send path
- [ ] `guards.ts` — `requireKYCTier`, `requirePrimaryPhone` exported and tested
- [ ] `telegram.ts` — `TELEGRAM_WEBHOOK_SECRET` validated (constant-time compare)
- [ ] PR #27 approved and merged to `main`
- [ ] Local `main` pulled and confirmed

---

## 11. Escalation Rules

- **If a test is structurally unwritable** (e.g. requires live Termii API key): mock the network call with `vi.fn()`. Never skip a required test.
- **If a file truly does not exist after all commits**: implement it from scratch using the spec in `docs/milestones/m7ef-replit-brief.md` as the authoritative source.
- **If the PR cannot be merged via API** (permissions issue): push the branch and note the PR URL for manual merge. Do not leave the branch un-pushed.
- **If typecheck produces an error in a pre-existing file unrelated to M7ef**: fix it anyway. Zero errors is the standard.
