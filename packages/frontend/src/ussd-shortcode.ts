/**
 * USSD shortcode constants and display helpers (M7e).
 * NCC registration pending — do not hardcode shortcode outside this file.
 *
 * @see docs/governance/milestone-tracker.md — M7 QA Gate: NCC *384# registration
 */

export const USSD_SHORTCODE = '*384#' as const;
export const USSD_SHORTCODE_DISPLAY = '*384#';

/**
 * Returns localised text for USSD shortcode prompt.
 * Usage: <span>{formatUSSDPrompt()}</span>
 */
export function formatUSSDPrompt(
  locale: 'en' | 'pcm' = 'en',
): string {
  if (locale === 'pcm') {
    return `Dial ${USSD_SHORTCODE} from any phone — even without data`;
  }
  return `Dial ${USSD_SHORTCODE} from any phone — no data required`;
}

/**
 * Returns a tel: link that opens the USSD dialler on mobile.
 * Safe to use in <a href> — encodes the * and # correctly.
 */
export function getUSSDDialLink(): string {
  return `tel:${encodeURIComponent(USSD_SHORTCODE)}`;
}
