/**
 * English (en-NG) locale strings — i18next compatible.
 * ISO 639-1: en — English (Nigeria)
 *
 * This is the canonical baseline. All other locales must have keys matching this file.
 * Monetary values always display as ₦ (Naira).
 */
export const enLocale: Record<string, string> = {
  // --- Navigation ---
  'nav.home': 'Home',
  'nav.discover': 'Discover',
  'nav.community': 'Community',
  'nav.wallet': 'My Wallet',
  'nav.profile': 'My Profile',

  // --- Auth ---
  'auth.login': 'Sign In',
  'auth.logout': 'Sign Out',
  'auth.register': 'Create Account',
  'auth.phone_label': 'Phone Number',
  'auth.otp_prompt': 'Enter the code sent to your phone',
  'auth.otp_resend': 'Resend code',
  'auth.otp_resend_wait': 'Wait {{seconds}} seconds before requesting again',
  'auth.kyc_required': 'Please verify your identity to continue',
  'auth.bvn_consent': 'We need to verify your BVN to activate full account features',

  // --- Wallet ---
  'wallet.balance': 'Your balance is ₦{{amount}}',
  'wallet.topup': 'Add Money',
  'wallet.send': 'Send Money',
  'wallet.history': 'Transaction History',
  'wallet.airtime': 'Buy Airtime',
  'wallet.airtime_amount': 'How much airtime would you like?',
  'wallet.insufficient': 'Insufficient balance. Please top up your account.',
  'wallet.success': 'Transaction successful! ₦{{amount}}',
  'wallet.failed': 'Transaction failed. Please try again.',

  // --- Community ---
  'community.join': 'Join Community',
  'community.leave': 'Leave Community',
  'community.join_success': "You've joined {{name}}!",
  'community.post_placeholder': "What's on your mind? Share with the community...",
  'community.reply': 'Reply',
  'community.course_locked': 'Upgrade your membership to access this course',
  'community.event_rsvp': "I'll attend",
  'community.event_rsvp_maybe': 'Maybe',

  // --- Social ---
  'social.post_placeholder': "What's happening? Tell us...",
  'social.follow': 'Follow',
  'social.unfollow': 'Unfollow',
  'social.followers': '{{count}} Followers',
  'social.following': 'Following {{count}}',
  'social.dm': 'Send Message',
  'social.story_expired': 'This story has expired',
  'social.report': 'Report this post',

  // --- KYC ---
  'kyc.tier0': 'Your account is not verified',
  'kyc.tier1': 'Phone number verified',
  'kyc.tier2': 'BVN verified',
  'kyc.tier3': 'Fully verified account',
  'kyc.upgrade_prompt': 'Verify your {{document}} to unlock more features',

  // --- NDPR Consent ---
  'consent.title': 'We need your permission',
  'consent.body': 'We would like to use your {{dataType}} to {{purpose}}. You can change your mind at any time.',
  'consent.agree': 'I agree',
  'consent.decline': 'I do not agree',

  // --- Errors ---
  'error.network': 'Network error. Please check your connection.',
  'error.server': 'Something went wrong. Please try again shortly.',
  'error.not_found': 'The item you are looking for was not found.',
  'error.unauthorized': 'You do not have permission to do this.',
  'error.rate_limited': 'Too many attempts. Please wait before trying again.',

  // --- USSD ---
  'ussd.shortcode': 'Dial {{code}} from any phone — no internet required',
  'ussd.no_data_needed': 'No data required',

  // --- PWA ---
  'pwa.install_prompt': 'Add WebWaka to your home screen for faster access — works offline once installed',
  'pwa.offline_banner': "You're offline. Some features are unavailable, but you can still read saved content.",
  'pwa.sync_pending': '{{count}} updates waiting to sync when you reconnect.',

  // --- Geography ---
  'geo.select_state': 'Select your state',
  'geo.select_lga': 'Select your LGA',
  'geo.select_ward': 'Select your ward',
  'geo.loading': 'Loading...',
};
