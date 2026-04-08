/**
 * Naija Pidgin (pcm) locale strings — i18next compatible.
 * ISO 639-3: pcm — Nigerian Pidgin
 *
 * Scope: Core platform UI strings used across all verticals.
 * Extended locale strings live in each vertical package (community, social, etc.)
 *
 * Guidelines:
 * - Use standard Naija Pidgin as spoken in Lagos, Warri, Port Harcourt, Abuja.
 * - Avoid Yoruba/Igbo/Hausa-specific words unless they are pan-Nigeria common.
 * - Tech terms (OTP, BVN, NIN) remain in English — they are widely understood.
 * - Monetary values always display as ₦ (Naira) never "dollar" or "pounds".
 */
export const pcmLocale: Record<string, string> = {
  // --- Navigation ---
  'nav.home': 'Home',
  'nav.discover': 'Find Tings',
  'nav.community': 'Community',
  'nav.wallet': 'My Wallet',
  'nav.profile': 'My Profile',

  // --- Auth ---
  'auth.login': 'Enter',
  'auth.logout': 'Comot',
  'auth.register': 'Join Up',
  'auth.phone_label': 'Your Phone Number',
  'auth.otp_prompt': 'Enter di code wey we send to your phone',
  'auth.otp_resend': 'Send code again',
  'auth.otp_resend_wait': 'Wait {{seconds}} seconds before you try again',
  'auth.kyc_required': 'You need to verify your details first',
  'auth.bvn_consent': 'Abeg, make we confirm your BVN make your account work well',

  // --- Wallet ---
  'wallet.balance': 'Your balance na ₦{{amount}}',
  'wallet.topup': 'Add Money',
  'wallet.send': 'Send Money',
  'wallet.history': 'Your Transactions',
  'wallet.airtime': 'Buy Airtime',
  'wallet.airtime_amount': 'How much airtime you want?',
  'wallet.insufficient': 'Oga, your balance no reach. Add money first.',
  'wallet.success': 'Transaction don go through! ₦{{amount}}',
  'wallet.failed': 'Transaction fail. Try again.',

  // --- Community ---
  'community.join': 'Join Community',
  'community.leave': 'Leave Community',
  'community.join_success': 'You don join! Welcome to {{name}}',
  'community.post_placeholder': 'Wetin dey your mind? Share with di community...',
  'community.reply': 'Reply',
  'community.course_locked': 'You need to upgrade your membership to see this course',
  'community.event_rsvp': 'I go attend',
  'community.event_rsvp_maybe': 'Maybe I go come',

  // --- Social ---
  'social.post_placeholder': 'Wetin dey happen? Tell us...',
  'social.follow': 'Follow',
  'social.unfollow': 'Unfollow',
  'social.followers': '{{count}} Followers',
  'social.following': 'Following {{count}}',
  'social.dm': 'Send Message',
  'social.story_expired': 'Dis story don expire',
  'social.report': 'Report dis post',

  // --- KYC ---
  'kyc.tier0': 'You never verify your account',
  'kyc.tier1': 'Your phone don verify',
  'kyc.tier2': 'Your BVN don verify',
  'kyc.tier3': 'Account fully verified',
  'kyc.upgrade_prompt': 'Verify your {{document}} make you fit do more tings',

  // --- NDPR Consent ---
  'consent.title': 'We need your permission',
  'consent.body': 'Make we use your {{dataType}} to {{purpose}}. You fit change your mind anytime.',
  'consent.agree': 'I agree',
  'consent.decline': 'No, I no agree',

  // --- Errors ---
  'error.network': 'Network wahala. Check your connection.',
  'error.server': 'Something do. Try again small time.',
  'error.not_found': 'We no see wetin you dey find.',
  'error.unauthorized': 'You no get permission for dis one.',
  'error.rate_limited': 'You don try too many times. Rest small, then try again.',

  // --- USSD ---
  'ussd.shortcode': 'Dial {{code}} from any phone to access WebWaka without data',
  'ussd.no_data_needed': 'No data needed',

  // --- PWA ---
  'pwa.install_prompt': 'Add WebWaka to your home screen for faster access — no data needed once installed',
  'pwa.offline_banner': 'You dey offline. Some tings no go work, but you fit still read your saved content.',
  'pwa.sync_pending': '{{count}} updates dey wait to sync when you get data back.',

  // --- Geography ---
  'geo.select_state': 'Choose your state',
  'geo.select_lga': 'Choose your LGA',
  'geo.select_ward': 'Choose your ward',
  'geo.loading': 'Loading...',
};
