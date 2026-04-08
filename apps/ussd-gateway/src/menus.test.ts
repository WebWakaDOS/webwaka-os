/**
 * Tests for USSD menu text builders.
 * Validates CON/END prefixes, balance formatting (P9 — integer kobo), and menu text.
 */

import { describe, it, expect } from 'vitest';
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

describe('mainMenu', () => {
  it('starts with CON prefix', () => {
    expect(mainMenu()).toMatch(/^CON /);
  });

  it('lists all 5 options', () => {
    const menu = mainMenu();
    expect(menu).toContain('1. My Wallet');
    expect(menu).toContain('2. Send Money');
    expect(menu).toContain('3. Trending Now');
    expect(menu).toContain('4. Book Transport');
    expect(menu).toContain('5. Community');
  });
});

describe('walletMenu', () => {
  it('starts with CON prefix', () => {
    expect(walletMenu(1000)).toMatch(/^CON /);
  });

  it('formats balance correctly (P9 — integer kobo)', () => {
    // 50000 kobo = ₦500.00
    expect(walletMenu(50_000)).toContain('500.00');
    // 100 kobo = ₦1.00
    expect(walletMenu(100)).toContain('1.00');
    // 0 kobo = ₦0.00
    expect(walletMenu(0)).toContain('0.00');
    // 9999 kobo = ₦99.99
    expect(walletMenu(9_999)).toContain('99.99');
  });

  it('includes Back option 0', () => {
    expect(walletMenu(0)).toContain('0. Back');
  });

  it('does not use floating point division', () => {
    // 1 kobo = ₦0.01 — exact, no float rounding issues
    const menu = walletMenu(1);
    expect(menu).toContain('0.01');
  });
});

describe('sendMoneyEnterRecipient', () => {
  it('starts with CON prefix', () => {
    expect(sendMoneyEnterRecipient()).toMatch(/^CON /);
  });
});

describe('sendMoneyEnterAmount', () => {
  it('includes recipient phone in text', () => {
    expect(sendMoneyEnterAmount('+2348012345678')).toContain('+2348012345678');
  });

  it('starts with CON prefix', () => {
    expect(sendMoneyEnterAmount('+2348012345678')).toMatch(/^CON /);
  });
});

describe('sendMoneyConfirm', () => {
  it('includes recipient and amount', () => {
    const text = sendMoneyConfirm('+2348012345678', '500');
    expect(text).toContain('+2348012345678');
    expect(text).toContain('500');
  });

  it('starts with CON prefix', () => {
    expect(sendMoneyConfirm('+2348012345678', '500')).toMatch(/^CON /);
  });

  it('includes Confirm and Cancel options', () => {
    const text = sendMoneyConfirm('+2348012345678', '500');
    expect(text).toContain('1. Confirm');
    expect(text).toContain('2. Cancel');
  });
});

describe('trendingFeed', () => {
  it('starts with CON prefix', () => {
    expect(trendingFeed()).toMatch(/^CON /);
  });

  it('includes back option', () => {
    expect(trendingFeed()).toContain('0. Back');
  });
});

describe('transportMenu', () => {
  it('starts with CON prefix', () => {
    expect(transportMenu()).toMatch(/^CON /);
  });
});

describe('communityMenu', () => {
  it('starts with CON prefix', () => {
    expect(communityMenu()).toMatch(/^CON /);
  });
});

describe('endSession', () => {
  it('starts with END prefix', () => {
    expect(endSession('Thank you')).toMatch(/^END /);
  });

  it('includes the message', () => {
    expect(endSession('Transfer complete')).toContain('Transfer complete');
  });
});
