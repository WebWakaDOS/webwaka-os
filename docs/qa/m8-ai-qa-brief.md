# M8-AI Planning QA Brief

**For:** Expert QA Agent  
**Date:** 2026-04-09  
**Branch:** `main` — HEAD `7419aae`  
**Scope:** Review, cross-reference, and fix all issues in the M8-AI planning document suite  
**No code changes were made — this is a documentation-only milestone**

---

## 1. What Was Done (Task Summary)

Fifteen planning documents were created for the WebWaka OS M8-AI Platform milestone:

| # | File | Description |
|---|---|---|
| 1 | `docs/planning/m8-ai-phase0-repo-audit.md` | Exhaustive repo audit — 10 confirmed AI surfaces, all gaps |
| 2 | `docs/planning/m8-ai-existing-context-map.md` | Package/app/migration/route AI touchpoint map |
| 3 | `docs/planning/m8-ai-gap-analysis.md` | 25 gaps, priority 1/2/3 classification |
| 4 | `docs/planning/m8-ai-architecture-decision-log.md` | ADL-001 through ADL-009 |
| 5 | `docs/governance/ai-platform-master-plan.md` | Vision, policy, billing, autonomy, phases |
| 6 | `docs/governance/ai-capability-matrix.md` | 18 capabilities with per-capability billing/HITL/plan rules |
| 7 | `docs/governance/ai-provider-routing.md` | 5-level resolution chain, provider/model registry |
| 8 | `docs/governance/ai-billing-and-entitlements.md` | Credit units, D1 schema, migrations 0037–0041 |
| 9 | `docs/governance/ai-agent-autonomy.md` | L0–L5 autonomy levels, write permission matrix |
| 10 | `docs/governance/ai-integration-framework.md` | All 17 P1 verticals AI integration mapped |
| 11 | `docs/governance/ai-context-map.md` | Governance-level AI touchpoint inventory |
| 12 | `docs/governance/ai-repo-wiring.md` | Every file, route, migration, test to create/expand |
| 13 | `docs/implementation/m8-ai-phase-plan.md` | M8a-AI-1 through M8a-AI-4, success criteria |
| 14 | `docs/templates/vertical-ai-research-template.md` | Per-vertical AI research template (12 sections) |
| 15 | `docs/qa/ai-platform-qa-framework.md` | 74 QA scenarios across 9 test families |

**A user-requested addition was incorporated mid-session (ADL-009):**
- AI aggregators (OpenRouter, Groq, Together, Fireworks, Portkey, AI/ML API) added as first-class provider IDs
- Chinese AI providers (DeepSeek, Qwen/Alibaba, Zhipu/GLM, Moonshot/Kimi, MiniMax, Yi/01.AI) added
- `AIProvider` union type expanded from 4 values to 15
- Model tiers expanded from 2 (`best`/`cost`) to 4 (`best`/`cost`/`multilingual`/`reasoning`)
- OpenAI-compatible adapter renamed from `openai.ts` to `openai-compat.ts` to reflect that it serves all OAI-compatible providers (aggregators + Chinese)
- Failover chains updated across `ai-provider-routing.md` and `ai-platform-master-plan.md`
- Env var list expanded to include `OPENROUTER_API_KEY_1`, `DEEPSEEK_API_KEY_1`, `QWEN_API_KEY_1`, `GROQ_API_KEY_1`, `MINIMAX_API_KEY_1`
- ADL-009 added to `docs/planning/m8-ai-architecture-decision-log.md`

---

## 2. Pre-Flight Checks (Run First)

Before reviewing content, confirm the document suite is structurally complete:

```bash
# Confirm all 15 files exist
ls -1 \
  docs/planning/m8-ai-phase0-repo-audit.md \
  docs/planning/m8-ai-existing-context-map.md \
  docs/planning/m8-ai-gap-analysis.md \
  docs/planning/m8-ai-architecture-decision-log.md \
  docs/planning/m8-ai-repo-audit-summary.md \
  docs/governance/ai-platform-master-plan.md \
  docs/governance/ai-capability-matrix.md \
  docs/governance/ai-provider-routing.md \
  docs/governance/ai-billing-and-entitlements.md \
  docs/governance/ai-agent-autonomy.md \
  docs/governance/ai-integration-framework.md \
  docs/governance/ai-context-map.md \
  docs/governance/ai-repo-wiring.md \
  docs/implementation/m8-ai-phase-plan.md \
  docs/templates/vertical-ai-research-template.md \
  docs/qa/ai-platform-qa-framework.md

# Count total lines (expect 3,700+)
wc -l docs/governance/ai-*.md docs/planning/m8-ai-*.md docs/implementation/m8-ai-*.md docs/qa/ai-*.md docs/templates/vertical-ai-*.md

# Confirm ADL count (expect ADL-001 through ADL-009)
grep "^## ADL-" docs/planning/m8-ai-architecture-decision-log.md

# Confirm model tiers (expect best, cost, multilingual, reasoning)
grep -i "multilingual\|reasoning" docs/governance/ai-provider-routing.md | head -10
```

---

## 3. Primary Cross-Reference Checks

The highest-risk inconsistency surface is the **provider/adapter architecture** added via ADL-009. Check all six of the following cross-references:

### 3a. AIProvider Type — Is It Consistent Everywhere?

The `AIProvider` union type was expanded to:
```typescript
'openai' | 'anthropic' | 'google'
| 'openrouter' | 'portkey' | 'together' | 'groq' | 'fireworks' | 'aimlapi'
| 'deepseek' | 'qwen' | 'zhipu' | 'moonshot' | 'minimax' | 'yi'
| 'byok_custom'
```

**Check:**
- `docs/implementation/m8-ai-phase-plan.md` — M8a-AI-1 section — `AIProvider` type expansion block — does it list all 15 values?
- `docs/planning/m8-ai-architecture-decision-log.md` — ADL-009 Consequences section — does it list all 15 values?
- `docs/governance/ai-provider-routing.md` — Section 5b/5c/5d provider tables — do the `provider_id` values in the tables match the type union above?
- `docs/planning/m8-ai-phase0-repo-audit.md` — still references the old 4-value `AIProvider` type from `packages/ai-abstraction/src/types.ts` — **must be updated to note the planned expansion**
- `docs/planning/m8-ai-existing-context-map.md` — adapter map section — does it reference `openai-compat.ts` (new name) or `openai.ts` (old name)?

### 3b. Adapter Filename — `openai.ts` vs `openai-compat.ts`

The adapter was renamed from `openai.ts` to `openai-compat.ts` to reflect it serves all OpenAI-compatible providers. **Check every document for the old filename:**

```bash
grep -r "openai\.ts" docs/
```

Any reference to `openai.ts` (without the `-compat` suffix) in the adapter context must be updated to `openai-compat.ts`. Exception: references to the **old M3 type contracts** in `packages/ai-abstraction/src/types.ts` are fine — that is a separate file.

### 3c. Model Tiers — Are All Four Defined Everywhere?

Documents that define model tiers must include all four: `best`, `cost`, `multilingual`, `reasoning`.

**Check each document that references model tiers:**
- `docs/governance/ai-provider-routing.md` — sections 6 (Model Registry) and 8 (Failover Ordering) — do both sections include `multilingual` and `reasoning` chains?
- `docs/governance/ai-platform-master-plan.md` — section 9 (Model Routing Policy) — does the Four Model Tiers table exist and list all four?
- `docs/governance/ai-capability-matrix.md` — Text Generation entry — does it reference all four tier chains?
- `docs/governance/ai-repo-wiring.md` — plan-config expand section — does `workspace_ai_settings.model_tier` allow all four values or still just `'cost'/'best'`?
- `docs/implementation/m8-ai-phase-plan.md` — migration 0041 schema for `workspace_ai_settings.model_tier` CHECK constraint — does it include `multilingual` and `reasoning` or only `cost`/`best`?

### 3d. Failover Chains — Completeness and Consistency

The failover chains in `ai-provider-routing.md` section 8 and `ai-platform-master-plan.md` section 7 must agree.

**Check:**
- Does `ai-platform-master-plan.md` section 7 (Failover and Fallback Policy) still reference the old 3-provider chain (`OpenAI → Anthropic → Google`) or has it been updated with DeepSeek-first and OpenRouter as aggregator fallback?
- Does section 7 in the master plan reference the four tiers, or does it still use a generic chain?
- Do both documents agree on which provider is the **platform-level aggregator fallback** (should be OpenRouter)?

### 3e. NDPR Compliance Note — Present in Every Chinese Provider Reference?

The NDPR compliance note ("Chinese providers require the same data residency compliance review as Western providers before being enabled for PII-adjacent tasks") must appear in:
- `docs/governance/ai-provider-routing.md` — section 5d (Chinese AI Providers)
- `docs/governance/ai-platform-master-plan.md` — section 9 (Chinese Provider Economics)
- `docs/planning/m8-ai-architecture-decision-log.md` — ADL-009

**Check:** Is the note absent from any of these? If so, add it.

### 3f. QA Framework — Does It Cover the New Providers?

`docs/qa/ai-platform-qa-framework.md` was written before the ADL-009 expansion. **Check whether any of the following test scenarios are missing:**

- Provider Failover Tests (PFT): Is there a test for OpenRouter as catch-all fallback when all direct providers fail?
- Provider Failover Tests: Is there a test for DeepSeek 429 → falls back to OpenRouter?
- Capability Routing Tests (CRT): Is there a test for the `multilingual` tier routing to Qwen (not OpenAI)?
- Capability Routing Tests: Is there a test for the `reasoning` tier routing to DeepSeek R1?
- BYOK Tests (BKT): Is there a test for registering an OpenRouter key as workspace BYOK and verifying it resolves correctly?
- Is there a test verifying the `openai-compat` adapter's `baseUrl` override works (e.g., DeepSeek `baseUrl` produces a call to `api.deepseek.com` not `api.openai.com`)?

If any of these are missing, add them to the QA framework under the appropriate section. Renumber scenarios only if gaps exist.

---

## 4. Secondary Consistency Checks

### 4a. Migration Numbering — No Conflicts

The planned migrations are:
- `0037_ai_provider_keys.sql`
- `0038_ai_usage_logs.sql`
- `0039_ai_credits.sql`
- `0040_ai_hitl.sql`
- `0041_workspace_ai_settings.sql`

**Check:**
```bash
ls infra/db/migrations/ | sort
```

The last committed migration is `0036_verticals_table.sql`. Confirm 0037–0041 are not in conflict with any existing file. If the repo already has any of 0037–0041, the document numbering must be corrected throughout all 15 files.

Also check: does `docs/governance/ai-billing-and-entitlements.md` reference the correct migration numbers in its D1 schema section? Does `docs/implementation/m8-ai-phase-plan.md`?

### 4b. workspace_ai_settings Migration — CHECK Constraint

`docs/implementation/m8-ai-phase-plan.md` contains the planned SQL for `0041_workspace_ai_settings.sql`. The `model_tier` column has a CHECK constraint:
```sql
model_tier TEXT NOT NULL DEFAULT 'cost' CHECK (model_tier IN ('cost','best'))
```

This is now outdated — there are four tiers. It must be:
```sql
model_tier TEXT NOT NULL DEFAULT 'cost' CHECK (model_tier IN ('cost','best','multilingual','reasoning'))
```

**Fix this in `docs/implementation/m8-ai-phase-plan.md` if not already done.**

### 4c. Env Vars — Consistent Across All Documents

Three documents reference the env var additions:
- `docs/implementation/m8-ai-phase-plan.md` — M8a-AI-1 section
- `docs/governance/ai-provider-routing.md` — section 1 (Super-Admin Platform Keys)
- `docs/planning/m8-ai-phase0-repo-audit.md` — section 1.8 (Env Variables)

**Check:** Do all three agree? Does the audit document (written before ADL-009) still show the old list (only `OPENAI_API_KEY_1`, `ANTHROPIC_API_KEY_1`, `GOOGLE_AI_API_KEY_1`)? If so, update section 1.8 of the audit doc to note that ADL-009 added `OPENROUTER_API_KEY_1`, `DEEPSEEK_API_KEY_1`, `QWEN_API_KEY_1`, `GROQ_API_KEY_1`, `MINIMAX_API_KEY_1`.

Also check: `docs/governance/ai-repo-wiring.md` — is there an env.ts section? Does it list the new aggregator and Chinese provider keys?

### 4d. `ai-repo-wiring.md` — New Test Count

`docs/governance/ai-repo-wiring.md` specifies a total new test count for M8a-AI. **Check:**
- Does the test count table reflect the renamed `openai-compat.test.ts` (not `openai.test.ts`)?
- Was the test count for `openai-compat.test.ts` updated from ≥8 to ≥10 (as specified in the phase plan)?
- Does the total minimum test count match the sum of individual test counts?
- Does the total still reference ≥66 new AI tests? (Original: ≥8 + ≥5 + ≥3 + ≥10 + ≥5 + ≥5 + ≥5 + ≥15 + ≥10 = ≥66)

### 4e. `ai-context-map.md` (governance) — Planned Touchpoints

`docs/governance/ai-context-map.md` has a "Planned (M8-AI — This Milestone)" table. **Check:**
- Does it reference `openai-compat.ts` or `openai.ts` for the adapter?
- Does it list the OpenRouter/aggregator env vars as planned?
- Does the `ai_provider_keys` D1 table description note that `provider` column supports all 15 provider IDs?

### 4f. Vertical AI Opportunity Map — Provider Column

`docs/governance/ai-context-map.md` contains a "Vertical AI Opportunity Map" table with a column for plan gate and HITL. **Check** whether any vertical is mapped to a capability that is now available at a lower cost due to Chinese providers (e.g., if a vertical was listed as requiring Enterprise because of cost, it may now be viable at Growth tier due to DeepSeek pricing). Flag any that may need revisiting.

### 4g. `ai-gap-analysis.md` — Priority 1 Blocker Still References `openai.ts`

`docs/planning/m8-ai-gap-analysis.md` in the "Must Be Created" section lists:
```
packages/ai-adapters/src/openai.ts
```

**Check** whether this still appears as `openai.ts` or whether it was updated to `openai-compat.ts`.

---

## 5. Structural and Prose Checks

For each of the 15 documents, verify:

| Check | Description |
|---|---|
| **Headers in sequence** | No skipped heading levels (e.g., H2 → H4 with no H3) |
| **No orphaned sections** | Every `---` divider has content above and below it |
| **Tables have consistent column counts** | Every row in every markdown table has the same number of pipe characters |
| **No placeholder text** | No `{slug}`, `{insert}`, `TODO`, `TBD`, `FIXME` left in non-template files (the template file is allowed to have `{slug}` etc.) |
| **Cross-document references are accurate** | When one document says "see `ai-provider-routing.md` section X", that section exists with that number |
| **Code blocks close** | Every opening triple-backtick has a matching close |
| **No duplicated section numbers** | No two `## 5.` or `## ADL-005` entries in the same document |

---

## 6. Existing Document Compatibility Checks

These pre-existing documents must not contradict the new M8-AI suite:

| Existing Document | What to Verify |
|---|---|
| `docs/governance/ai-policy.md` (M1) | New docs extend it, not contradict it. Core 6 principles and 5 rules must still be satisfied |
| `docs/architecture/decisions/0009-ai-provider-abstraction.md` (TDR-0009) | ADL-009 extends TDR-0009; it does not violate it. The "no direct provider SDK calls" rule still holds — all providers go through the adapter |
| `packages/ai-abstraction/src/types.ts` (M3 existing) | `docs/planning/m8-ai-phase0-repo-audit.md` section 1.1 says the existing type is `AIProvider = 'openai' | 'anthropic' | 'google' | 'byok'`. The plan must consistently note this is the CURRENT state and the M8a-AI-1 task will expand it |
| `packages/entitlements/src/plan-config.ts` | `aiRights: boolean` still exists (ADL-003). No document should suggest it is being removed |
| `docs/governance/platform-invariants.md` P7 | "No single-provider lock-in" and "AI calls via abstraction layer" — all new providers must route through adapters, not called directly. Verify this is consistently stated |

---

## 7. Compliance Consistency Checks

| Compliance Item | Check |
|---|---|
| **NDPR** | Every document that mentions PII processing by AI must also reference the consent check requirement. Search: `grep -l "PII\|personal data" docs/governance/ai-*.md` — each result must also contain `consent_records` or `NDPR consent` |
| **CBN KYC** | Any AI feature touching financial data must reference minimum KYC tier. Check `ai-integration-framework.md` analytics section — does it note "read-only, no financial writes" consistently? |
| **USSD exclusion** | `ai-integration-framework.md`, `ai-agent-autonomy.md`, and `ai-platform-master-plan.md` all mention USSD exclusion. Verify all three are consistent (`X-USSD-Session` header → short-circuit) |
| **Sensitive sector consistency** | ADL-007 locks: Politician, Clinic, Legal = `sensitiveSectorRights` required + HITL mandatory. Verify `ai-integration-framework.md` section 3 (Civic domain / NGO) and section 4 (Social) do not contradict this for any vertical |
| **Financial table prohibition** | `ai-agent-autonomy.md` section 2 (Write Permissions Matrix) lists absolute prohibitions. Verify `ai-integration-framework.md` section 7 (Analytics) does not contradict this — AI analytics must be read-only on all financial tables |

---

## 8. Final Deliverable

After completing all checks and fixes, produce:

### `docs/qa/m8-ai-qa-report.md`

Following the format of `docs/qa/m7b-qa-report.md` (if available) or this structure:

```markdown
# M8-AI Planning QA Report

**QA Agent:** [name]
**Date:** YYYY-MM-DD
**Scope:** 15 M8-AI planning documents
**Result:** PASS / PASS WITH FIXES / FAIL

## Summary
N issues found. N fixed. N deferred (with reason).

## Issues Found and Fixed
| ID | File | Line/Section | Issue | Fix Applied |
|---|---|---|---|---|
| QA-001 | file.md | Section X | Description | Fixed — [what was done] |

## Issues Deferred (Not Fixed)
| ID | File | Issue | Reason Deferred |
...

## Cross-Reference Validation Results
| Check ID | Description | Result |
|---|---|---|
| XR-01 | AIProvider type consistent across all documents | PASS / FAIL |
| XR-02 | Adapter filename (openai-compat.ts) consistent | PASS / FAIL |
| XR-03 | Four model tiers defined everywhere | PASS / FAIL |
| XR-04 | Failover chains consistent | PASS / FAIL |
| XR-05 | NDPR note present in all Chinese provider references | PASS / FAIL |
| XR-06 | QA framework covers aggregator/Chinese provider scenarios | PASS / FAIL |
| XR-07 | Migration numbers conflict-free | PASS / FAIL |
| XR-08 | workspace_ai_settings CHECK constraint updated | PASS / FAIL |
| XR-09 | Env vars consistent across documents | PASS / FAIL |
| XR-10 | Test counts accurate | PASS / FAIL |
| XR-11 | No `openai.ts` adapter references remain | PASS / FAIL |
| XR-12 | Existing docs not contradicted | PASS / FAIL |
| XR-13 | Compliance checks (NDPR, CBN, USSD, financial) | PASS / FAIL |

## Document-by-Document Status
| # | Document | Status | Notes |
|---|---|---|---|
| 1 | m8-ai-phase0-repo-audit.md | ✅ / ⚠️ / ❌ | |
...

## Verification Attestation
All 15 documents reviewed. All cross-references validated.
Commit SHA reviewed: 7419aae
Post-fix SHA: [new SHA if fixes were committed]
```

---

## 9. Working Notes for QA Agent

- All 15 files are in `main` at SHA `7419aae`. Read them before making any edits.
- Fix issues directly in the relevant document files. Do not create new files (except `docs/qa/m8-ai-qa-report.md`).
- When fixing a document, do not rewrite sections that are correct — make targeted edits.
- When the QA report references a fix, include enough context so the fix is auditable (section name, what the old text said, what the new text says).
- Commit all fixes in a single commit: `qa(m8-ai): QA review fixes — [N] issues resolved`
- Do not modify `docs/governance/ai-policy.md` or `docs/architecture/decisions/0009-ai-provider-abstraction.md` — those are locked M1 governance documents.
- Do not modify any source code files (`*.ts`, `*.sql`, `*.json`, etc.) — this is documentation QA only.
- The `docs/templates/vertical-ai-research-template.md` intentionally uses `{slug}`, `{vertical}` placeholders — do not flag those as issues.
