# TDR-0004: Replit as Primary Build Workbench

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka requires natural-language-driven implementation of a large TypeScript monorepo. Replit Agent 4 provides interactive, iterative coding capability for scaffolding packages, apps, schemas, and tests.

## Decision

Use Replit Agent 4 as the primary implementation workbench for code generation and package scaffolding, beginning in Milestone 2.

## Constraints

- Replit output must land in GitHub and pass all CI checks before being treated as complete
- Replit operates under the same governance rules as all other agents (see `AGENTS.md`)
- Base44 retains orchestration authority — Replit is the implementation arm, not the decision-maker
- All Replit sessions must start from the latest `main` branch state

## Consequences

- Accelerates scaffolding speed for repetitive structures (entities, routes, types, tests)
- Replit output quality varies — Base44 review before merge is mandatory for all Replit PRs
- Session continuity is handled via GitHub (see TDR-0003) — Replit sessions may not persist between runs
