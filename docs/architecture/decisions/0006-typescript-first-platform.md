# TDR-0006: TypeScript-First Platform

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka spans multiple applications, shared packages, and deployment targets (Cloudflare Workers, frontend SPAs). Consistency in language, type contracts, and tooling reduces friction across agent handoffs and developer onboarding.

## Decision

Use TypeScript as the primary language across all platform packages, apps, shared libraries, and test suites.

No new packages or apps may be created in plain JavaScript.

## Consequences

- Shared type contracts in `packages/types` can be consumed safely across all apps and packages
- TypeScript strict mode is the default — `strict: true` in all `tsconfig.json` files
- Type errors block CI — no `any`-based workarounds to unblock builds; fix the types
- The `check-core-version` workflow enforces package version consistency at the type level
- Agents generating code must produce valid TypeScript that passes `tsc --noEmit`
