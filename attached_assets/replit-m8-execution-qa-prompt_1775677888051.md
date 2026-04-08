# Replit QA Agent: M8 Verticals Master Plan SELF-VERIFICATION

**SELF-CHECK:** Verify your own M8 planning outputs before PR.

**RUN ON:** Your generated files from replit-verticals-final-planning-prompt.md [file:346]

## AUTOMATED VERIFICATION (Execute these)

```
# 1. Repo state
git checkout main
git checkout -b feat/m8-verticals-master-plan
cp your-outputs/* correct-locations/
pnpm install

# 2. Technical validation
pnpm -r typecheck  # Must: 0 errors
pnpm --filter @webwaka/verticals test  # Must: ≥15 tests
wrangler db pull --local  # Validate 0036 migration syntax
csvlint infra/db/seeds/0004_verticals-master.csv  # Valid CSV

# 3. Content validation
grep -c "politician" docs/planning/m8-phase0-original-verticals.md  # ≥2
grep -c "church" docs/planning/m8-phase0-original-verticals.md  # ≥2
grep -c "POS.*Business Management" docs/governance/verticals-master-plan.md  # ≥1
grep -c "fintech\|transfer\|disburse" packages/verticals/  # Must: 0
wc -l infra/db/seeds/0004_verticals-master.csv  # ≥150 rows
```

## MANUAL CHECKLIST (25 Points)

### PHASE 0: ORIGINALS EXTRACTED?
```
[ ] docs/planning/m8-phase0-original-verticals.md:
    ✓ Individual Politicians (politics tables)
    ✓ Churches (Civic/community spaces)
    ✓ NGOs/Cooperatives (membership_tiers)
    ✓ Motor Parks (FRSC licensing)
    ✓ Carpooling (offerings.route)
    ✓ POS Business Management (inventory/CRM — NOT fintech)
[ ] NO assumptions — cites file/line for every claim
```

### INFRASTRUCTURE (M8a EXECUTABLE?)
```
[ ] infra/db/migrations/0036_verticals_table.sql — workspaces.vertical_id FK
[ ] packages/verticals/src/router.ts — loads vertical package by ID
[ ] packages/verticals/src/fsm-engine.ts — generic FSM
[ ] pnpm -r typecheck passes
```

### SYNTHESIS & SCALE
```
[ ] docs/governance/verticals-master-plan.md — ≥150 verticals table
[ ] infra/db/seeds/0004_verticals-master.csv — originals P1, Top100 P2
[ ] Originals Priority 1 (not Top20-only)
```

### FRAMEWORKS (PARALLEL READY)
```
[ ] docs/templates/vertical-template.md — research/impl template
[ ] docs/governance/verticals-dependency-dag.md — Mermaid infra→parallel
[ ] M8a–M12 frameworks — 3-day format + 1 sample each
[ ] Per-vertical research mandated (50+ features)
```

### ZERO-DRIFT
```
[ ] POS = "Business Management System" (grep confirms NO fintech)
[ ] Parallel post-M8a (DAG proves)
[ ] Entitlements matrix: model_fit → pricing tiers
[ ] Offline/P10 gating explicit (leverages M7)
```

## OUTPUT FORMAT (docs/qa/m8-self-verification.md)
```
# M8 Master Plan Self-Verification
**Status:** PASS | FAIL
**Automated Results:**
```
$ pnpm -r typecheck
✅ 0 errors
```

**Checklist:** 25/25

**PHASE 0 Quality:** Originals fully extracted ✓

**/self-approved-m8-planning** → Open PR feat/m8-verticals-master-plan
```

**FAIL → FIX → RERUN.** PR only on PASS + /self-approved-m8-planning.