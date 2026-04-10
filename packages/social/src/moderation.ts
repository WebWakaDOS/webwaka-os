/**
 * Content moderation for @webwaka/social.
 * Platform Invariant P15 — classifyContent must be called unconditionally
 * before every social post insert.
 *
 * SEC-003 fix: confidence is now stored as INTEGER basis points (0–10000)
 * where 10000 = 100.00% confidence. Never expose the raw float externally.
 * Display: confidenceBps / 10000 — compute only for display, never store.
 */

export type ModerationStatus = 'published' | 'auto_hide' | 'pending_review';

export interface ModerationResult {
  status: ModerationStatus;
  reason?: string;
  /** Confidence in basis points (0–10000). 10000 = 100.00% confident. */
  confidenceBps: number;
}

const SPAM_PATTERNS: RegExp[] = [
  /buy\s+cheap/i,
  /click\s+now/i,
  /follow\s+me/i,
  /earn\s+money\s+fast/i,
  /make\s+money/i,
  /free\s+gift/i,
  /limited\s+offer/i,
  /act\s+now/i,
  /cheap\s+watches/i,
  /100%\s+guaranteed/i,
  /wire\s+transfer/i,
  /nigerian\s+prince/i,
];

/**
 * Classify content for moderation.
 * Returns 'auto_hide' if spam patterns are detected, 'published' otherwise.
 * confidenceBps is stored as INTEGER basis points: 9000 = 90.00% confidence.
 */
export function classifyContent(content: string): ModerationResult {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      return { status: 'auto_hide', reason: 'spam_detected', confidenceBps: 9000 };
    }
  }
  return { status: 'published', confidenceBps: 0 };
}
