/**
 * Tests for USSD input processor — multi-step flow validation.
 */

import { describe, it, expect } from 'vitest';
import { processUSSDInput } from './processor.js';
import type { USSDSession } from './session.js';

function makeSession(state: USSDSession['state'] = 'main_menu', data: Record<string, string> = {}): USSDSession {
  return {
    sessionId: 'sess_test',
    phone: '+2348012345678',
    state,
    data,
    createdAt: Date.now(),
  };
}

describe('processUSSDInput — main menu', () => {
  it('shows main menu on fresh session (empty text)', () => {
    const result = processUSSDInput(makeSession(), '');
    expect(result.text).toMatch(/^CON /);
    expect(result.ended).toBe(false);
  });

  it('routes "1" to wallet menu', () => {
    const result = processUSSDInput(makeSession(), '1');
    expect(result.session.state).toBe('wallet_menu');
    expect(result.text).toMatch(/^CON /);
    expect(result.ended).toBe(false);
  });

  it('routes "2" to send money (enter recipient)', () => {
    const result = processUSSDInput(makeSession(), '2');
    expect(result.session.state).toBe('send_money_enter_recipient');
    expect(result.ended).toBe(false);
  });

  it('routes "3" to trending feed', () => {
    const result = processUSSDInput(makeSession(), '3');
    expect(result.session.state).toBe('trending_feed');
    expect(result.ended).toBe(false);
  });

  it('routes "4" to transport menu', () => {
    const result = processUSSDInput(makeSession(), '4');
    expect(result.session.state).toBe('transport_menu');
    expect(result.ended).toBe(false);
  });

  it('routes "5" to community menu', () => {
    const result = processUSSDInput(makeSession(), '5');
    expect(result.session.state).toBe('community_menu');
    expect(result.ended).toBe(false);
  });

  it('ends session on invalid input', () => {
    const result = processUSSDInput(makeSession(), '9');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });
});

describe('processUSSDInput — wallet menu', () => {
  it('goes back to main menu on "0"', () => {
    const result = processUSSDInput(makeSession('wallet_menu'), '1*0');
    expect(result.session.state).toBe('main_menu');
    expect(result.text).toMatch(/^CON /);
    expect(result.ended).toBe(false);
  });

  it('ends on "1" (top up)', () => {
    const result = processUSSDInput(makeSession('wallet_menu'), '1*1');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('ends on "2" (history)', () => {
    const result = processUSSDInput(makeSession('wallet_menu'), '1*2');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });
});

describe('processUSSDInput — send money multi-step flow', () => {
  it('stores recipient in session data on enter_recipient step', () => {
    const session = makeSession('send_money_enter_recipient');
    const result = processUSSDInput(session, '2*+2348099999999');
    expect(result.session.state).toBe('send_money_enter_amount');
    expect(result.session.data['recipient']).toBe('+2348099999999');
    expect(result.ended).toBe(false);
  });

  it('rejects short phone number on enter_recipient', () => {
    const session = makeSession('send_money_enter_recipient');
    const result = processUSSDInput(session, '2*123');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('stores amount in session data on enter_amount step', () => {
    const session = makeSession('send_money_enter_amount', { recipient: '+2348099999999' });
    const result = processUSSDInput(session, '2*+2348099999999*500');
    expect(result.session.state).toBe('send_money_confirm');
    expect(result.session.data['amount']).toBe('500');
    expect(result.ended).toBe(false);
  });

  it('rejects invalid amount', () => {
    const session = makeSession('send_money_enter_amount', { recipient: '+2348099999999' });
    const result = processUSSDInput(session, '2*+2348099999999*abc');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('confirms transfer on "1" in send_money_confirm', () => {
    const session = makeSession('send_money_confirm', { recipient: '+2348099999999', amount: '500' });
    const result = processUSSDInput(session, '2*+2348099999999*500*1');
    expect(result.text).toMatch(/^END /);
    expect(result.text).toContain('initiated');
    expect(result.ended).toBe(true);
  });

  it('cancels transfer on "2" in send_money_confirm', () => {
    const session = makeSession('send_money_confirm', { recipient: '+2348099999999', amount: '500' });
    const result = processUSSDInput(session, '2*+2348099999999*500*2');
    expect(result.text).toMatch(/^END /);
    expect(result.text).toContain('cancelled');
    expect(result.ended).toBe(true);
  });
});

describe('processUSSDInput — trailing-input extraction', () => {
  it('extracts last pipe-segment as input', () => {
    // text="1*2*500" → lastInput="500" → processed in send_money_enter_amount
    const session = makeSession('send_money_enter_amount', { recipient: '+2348099999999' });
    const result = processUSSDInput(session, '2*+2348099999999*500');
    expect(result.session.data['amount']).toBe('500');
  });
});
