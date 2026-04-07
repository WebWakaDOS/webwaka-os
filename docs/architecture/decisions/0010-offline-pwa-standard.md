# TDR-0010: Offline and PWA Standard

**Status:** Accepted
**Date:** 7 April 2026
**Author:** Perplexity (Milestone 1)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026

---

## Context

WebWaka's primary market — Nigeria and broader Africa — operates on mobile-heavy, variable-connectivity infrastructure. A platform that requires stable internet to function will exclude large portions of its intended user base.

## Decision

Offline-first and PWA-first are baseline platform requirements, not optional enhancements.

Every customer-facing app must:
- Be installable as a PWA (valid manifest, service worker, HTTPS)
- Support cached reads of recently accessed data during offline periods
- Queue write operations when offline and sync on reconnection
- Provide visible offline/online state indicators to users

## Scope

This requirement applies to: brand surfaces, partner admin, public discovery.

It does not apply to: internal API workers (which are server-side and cannot be offline).

## Consequences

- Service worker strategy must be chosen per app in Milestone 2 — Cache-first for static assets, Network-first with cache fallback for API responses
- Sync queue implementation lives in `packages/core` and is shared
- Tests must include an offline simulation scenario for all critical write paths
- CI includes a Lighthouse PWA score check — minimum score of 80 required to pass
