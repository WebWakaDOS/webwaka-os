# TDR-0008: Auth and Tenancy Strategy

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka hosts individuals, organizations, partners, and places across multiple sectors. Each of these has a distinct identity, role, and level of access. Unauthorized cross-tenant data access is one of the most critical failure modes for a multi-tenant platform.

## Decision

Use explicit tenant-scoped authorization and workspace-aware access control throughout the platform.

Every protected action must evaluate both:
1. **Identity** — who the authenticated user is
2. **Tenant context** — which workspace they are operating in

Identity without tenant context is insufficient. Tenant context without identity is insufficient.

## Implementation Requirements

- JWT tokens must include both `user_id` and `workspace_id` claims
- All D1 queries on tenant-owned resources must include a `workspace_id` filter — no exceptions
- The `packages/auth` shared package enforces this contract
- Middleware must validate both claims before any handler executes
- Row-level filtering is implemented at the query layer, not the application layer

## Consequences

- Eliminates entire classes of tenant data leakage by making workspace context mandatory
- Increases complexity of auth flows — mitigated by centralizing all auth in `packages/auth`
- Agent-generated code must pass auth middleware correctly — enforced by CI integration tests
