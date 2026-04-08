/**
 * Content moderation for @webwaka/community.
 * Platform Invariant P15 — classifyContent must be called unconditionally
 * before every channel post insert.
 */

export type ModerationStatus = 'published' | 'auto_hide' | 'pending_review';

export interface ModerationResult {
  status: ModerationStatus;
  reason?: string;
  confidence: number;
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
 */
export function classifyContent(content: string): ModerationResult {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      return { status: 'auto_hide', reason: 'spam_detected', confidence: 0.9 };
    }
  }
  return { status: 'published', confidence: 0.0 };
}
