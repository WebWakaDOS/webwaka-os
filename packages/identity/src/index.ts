/**
 * @webwaka/identity
 *
 * Nigerian identity verification package.
 * Implements the IdentityProvider abstraction from TDR-0009 (M7 extension).
 *
 * Usage:
 *   import { verifyBVN, verifyNIN, verifyCAC, verifyFRSC } from '@webwaka/identity';
 *
 * See docs/identity/ for full API reference and compliance rules.
 * See docs/enhancements/m7/kyc-compliance.md for KYC strategy.
 *
 * IMPORTANT: All lookups require a ConsentRecord (Platform Invariant P10 — NDPR).
 * BVN/NIN values must never be logged (Security Baseline R7).
 */

// TODO M7a — Implement:
// - packages/identity/src/providers/prembly.ts
// - packages/identity/src/providers/paystack-identity.ts
// - packages/identity/src/consent.ts (requireConsentFor)
// - packages/identity/src/bvn.ts
// - packages/identity/src/nin.ts
// - packages/identity/src/cac.ts
// - packages/identity/src/frsc.ts
// - packages/identity/src/kyc-tier-updater.ts

export type {
  BVNVerifyResult,
  NINVerifyResult,
  CACVerifyResult,
  FRSCVerifyResult,
  IdentityProvider,
  ConsentRecord,
} from './types';

export { IDENTITY_STUB_VERSION } from './stub';
