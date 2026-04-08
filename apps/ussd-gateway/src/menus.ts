/**
 * USSD menu text builders.
 * All menus return either:
 *   CON <text>  — continue session (show menu, await input)
 *   END <text>  — terminate session
 *
 * Shortcode: *384#
 */

/**
 * Main menu — entry point for *384#
 */
export function mainMenu(): string {
  return `CON Welcome to WebWaka
1. My Wallet
2. Send Money
3. Trending Now
4. Book Transport
5. Community`;
}

/**
 * Wallet menu — shows current balance in Naira (converted from kobo).
 * Platform Invariant P9: balanceKobo is always an integer.
 */
export function walletMenu(balanceKobo: number): string {
  // Integer division — no floating point (P9)
  const nairaWhole = Math.floor(balanceKobo / 100);
  const koboPart = balanceKobo % 100;
  const balanceFormatted = `${nairaWhole}.${String(koboPart).padStart(2, '0')}`;
  return `CON My Wallet
Balance: \u20A6${balanceFormatted}
1. Top Up Float
2. Transaction History
0. Back`;
}

/**
 * Send money — enter recipient phone
 */
export function sendMoneyEnterRecipient(): string {
  return `CON Send Money
Enter recipient phone number:`;
}

/**
 * Send money — enter amount
 */
export function sendMoneyEnterAmount(recipient: string): string {
  return `CON Send Money to ${recipient}
Enter amount in Naira:`;
}

/**
 * Send money — confirm
 */
export function sendMoneyConfirm(recipient: string, amountNaira: string): string {
  return `CON Confirm Transfer
To: ${recipient}
Amount: \u20A6${amountNaira}
1. Confirm
2. Cancel`;
}

/**
 * Trending feed — top 5 placeholder
 */
export function trendingFeed(): string {
  return `CON Trending Now
1. See top stories
2. Local news
3. Business
4. Sports
5. Politics
0. Back`;
}

/**
 * Transport menu
 */
export function transportMenu(): string {
  return `CON Book Transport
1. Find nearby buses
2. My bookings
0. Back`;
}

/**
 * Community menu
 */
export function communityMenu(): string {
  return `CON Community
1. Announcements
2. Events
3. Groups
0. Back`;
}

/**
 * End a session with a message.
 */
export function endSession(message: string): string {
  return `END ${message}`;
}
