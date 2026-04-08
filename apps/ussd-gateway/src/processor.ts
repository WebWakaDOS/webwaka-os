/**
 * USSD input processor — routes input to correct handler based on session state.
 *
 * Africa's Talking encodes the full navigation path as pipe-separated values:
 *   text=""        → fresh session (empty string)
 *   text="1"       → selected option 1 from main menu
 *   text="1*2"     → from main menu → option 1 → option 2
 *
 * This processor uses session.state (not the full path) to drive the menu FSM.
 */

import type { USSDSession } from './session.js';
import {
  mainMenu,
  walletMenu,
  sendMoneyEnterRecipient,
  sendMoneyEnterAmount,
  sendMoneyConfirm,
  trendingFeed,
  transportMenu,
  communityMenu,
  endSession,
} from './menus.js';

export interface ProcessResult {
  text: string;
  session: USSDSession;
  ended: boolean;
}

/**
 * Get the last user input from the full pipe-delimited text.
 * text="1*2*500" → lastInput="500"
 * text="" → lastInput=""
 */
function lastInput(text: string): string {
  if (!text) return '';
  const parts = text.split('*');
  return parts[parts.length - 1] ?? '';
}

/**
 * Process USSD input for the current session state.
 * Returns the response text and the updated session.
 */
export function processUSSDInput(session: USSDSession, text: string): ProcessResult {
  const input = lastInput(text);
  const updatedSession: USSDSession = { ...session, data: { ...session.data } };

  switch (session.state) {
    case 'main_menu':
      return handleMainMenu(updatedSession, input);

    case 'wallet_menu':
      return handleWalletMenu(updatedSession, input);

    case 'send_money_enter_recipient':
      return handleEnterRecipient(updatedSession, input);

    case 'send_money_enter_amount':
      return handleEnterAmount(updatedSession, input);

    case 'send_money_confirm':
      return handleSendMoneyConfirm(updatedSession, input);

    case 'trending_feed':
      return handleTrendingFeed(updatedSession, input);

    case 'transport_menu':
      return handleTransportMenu(updatedSession, input);

    case 'community_menu':
      return handleCommunityMenu(updatedSession, input);

    default:
      return {
        text: endSession('Invalid session state. Please dial *384# again.'),
        session: updatedSession,
        ended: true,
      };
  }
}

function handleMainMenu(session: USSDSession, input: string): ProcessResult {
  if (!input) {
    // Fresh session
    return { text: mainMenu(), session: { ...session, state: 'main_menu' }, ended: false };
  }
  switch (input) {
    case '1':
      return {
        text: walletMenu(0), // Balance fetched from DB in route handler
        session: { ...session, state: 'wallet_menu' },
        ended: false,
      };
    case '2':
      return {
        text: sendMoneyEnterRecipient(),
        session: { ...session, state: 'send_money_enter_recipient' },
        ended: false,
      };
    case '3':
      return {
        text: trendingFeed(),
        session: { ...session, state: 'trending_feed' },
        ended: false,
      };
    case '4':
      return {
        text: transportMenu(),
        session: { ...session, state: 'transport_menu' },
        ended: false,
      };
    case '5':
      return {
        text: communityMenu(),
        session: { ...session, state: 'community_menu' },
        ended: false,
      };
    default:
      return {
        text: endSession('Invalid selection. Dial *384# to try again.'),
        session,
        ended: true,
      };
  }
}

function handleWalletMenu(session: USSDSession, input: string): ProcessResult {
  switch (input) {
    case '1':
      return { text: endSession('Contact your supervisor to top up your float.'), session, ended: true };
    case '2':
      return { text: endSession('Transaction history not available on USSD. Use the app.'), session, ended: true };
    case '0':
      return { text: mainMenu(), session: { ...session, state: 'main_menu' }, ended: false };
    default:
      return { text: endSession('Invalid selection.'), session, ended: true };
  }
}

function handleEnterRecipient(session: USSDSession, input: string): ProcessResult {
  if (!input || input.length < 10) {
    return { text: endSession('Invalid phone number. Please try again.'), session, ended: true };
  }
  return {
    text: sendMoneyEnterAmount(input),
    session: { ...session, state: 'send_money_enter_amount', data: { ...session.data, recipient: input } },
    ended: false,
  };
}

function handleEnterAmount(session: USSDSession, input: string): ProcessResult {
  const amount = parseFloat(input);
  if (isNaN(amount) || amount <= 0) {
    return { text: endSession('Invalid amount. Please try again.'), session, ended: true };
  }
  const recipient = session.data['recipient'] ?? 'Unknown';
  return {
    text: sendMoneyConfirm(recipient, input),
    session: { ...session, state: 'send_money_confirm', data: { ...session.data, amount: input } },
    ended: false,
  };
}

function handleSendMoneyConfirm(session: USSDSession, input: string): ProcessResult {
  if (input === '1') {
    const recipient = session.data['recipient'] ?? 'Unknown';
    const amount = session.data['amount'] ?? '0';
    return {
      text: endSession(`Transfer of \u20A6${amount} to ${recipient} initiated. Check the app for status.`),
      session,
      ended: true,
    };
  }
  if (input === '2') {
    return { text: endSession('Transfer cancelled.'), session, ended: true };
  }
  return { text: endSession('Invalid selection.'), session, ended: true };
}

function handleTrendingFeed(session: USSDSession, input: string): ProcessResult {
  if (input === '0') {
    return { text: mainMenu(), session: { ...session, state: 'main_menu' }, ended: false };
  }
  return { text: endSession('Feature coming soon. Dial *384# to try again.'), session, ended: true };
}

function handleTransportMenu(session: USSDSession, input: string): ProcessResult {
  if (input === '0') {
    return { text: mainMenu(), session: { ...session, state: 'main_menu' }, ended: false };
  }
  return { text: endSession('Transport booking coming soon.'), session, ended: true };
}

function handleCommunityMenu(session: USSDSession, input: string): ProcessResult {
  if (input === '0') {
    return { text: mainMenu(), session: { ...session, state: 'main_menu' }, ended: false };
  }
  return { text: endSession('Community features coming soon.'), session, ended: true };
}
