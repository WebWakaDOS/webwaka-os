/**
 * Tests for USSD input processor — multi-step flow validation.
 */

import { describe, it, expect } from 'vitest';
import { processUSSDInput } from './processor.js';
import type { USSDSession } from './session.js';

function makeSession(state: USSDSession['state'] = 'main_menu', data: Record<string, unknown> = {}): USSDSession {
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

// ============================================================================
// Branch 3 — Trending Feed FSM
// ============================================================================

const samplePosts = [
  { id: 'p1', snippet: 'Tech scene in Lagos is booming!', authorHandle: 'tunde_dev' },
  { id: 'p2', snippet: 'New fintech regulations announced.', authorHandle: 'naija_finance' },
  { id: 'p3', snippet: 'Champions League highlights!', authorHandle: 'sports_ng' },
];

describe('processUSSDInput — trending_feed (Branch 3)', () => {
  it('shows "0. Back" in trending feed menu', () => {
    const session = makeSession('trending_feed');
    const result = processUSSDInput(session, '3*0');
    // input "0" from trending_feed → back to main menu
    expect(result.session.state).toBe('main_menu');
    expect(result.ended).toBe(false);
  });

  it('"0" from trending_feed returns to main_menu', () => {
    const result = processUSSDInput(makeSession('trending_feed'), '3*0');
    expect(result.session.state).toBe('main_menu');
    expect(result.text).toMatch(/^CON /);
  });

  it('"1" with posts → state trending_view_post', () => {
    const session = makeSession('trending_feed', { trendingPosts: samplePosts });
    const result = processUSSDInput(session, '3*1');
    expect(result.session.state).toBe('trending_view_post');
    expect(result.ended).toBe(false);
  });

  it('"2" with posts → state trending_view_post with correct index', () => {
    const session = makeSession('trending_feed', { trendingPosts: samplePosts });
    const result = processUSSDInput(session, '3*2');
    expect(result.session.state).toBe('trending_view_post');
    expect(result.session.data['viewingPostIndex']).toBe(1);
  });

  it('"6" (out of range) ends session with error', () => {
    const session = makeSession('trending_feed', { trendingPosts: samplePosts });
    const result = processUSSDInput(session, '3*6');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('invalid letter input ends session', () => {
    const session = makeSession('trending_feed', { trendingPosts: samplePosts });
    const result = processUSSDInput(session, '3*x');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('"1" with empty posts ends session', () => {
    const session = makeSession('trending_feed', { trendingPosts: [] });
    const result = processUSSDInput(session, '3*1');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('viewPost text contains author handle', () => {
    const session = makeSession('trending_feed', { trendingPosts: samplePosts });
    const result = processUSSDInput(session, '3*1');
    expect(result.text).toContain('tunde_dev');
  });

  it('viewPost text contains post snippet', () => {
    const session = makeSession('trending_feed', { trendingPosts: samplePosts });
    const result = processUSSDInput(session, '3*1');
    expect(result.text).toContain('Tech scene');
  });

  it('"0" from trending_view_post → back to trending_feed', () => {
    const session = makeSession('trending_view_post', { trendingPosts: samplePosts, viewingPostIndex: 0 });
    const result = processUSSDInput(session, '3*1*0');
    expect(result.session.state).toBe('trending_feed');
    expect(result.ended).toBe(false);
  });
});

// ============================================================================
// Branch 5 — Community Menu FSM
// ============================================================================

const sampleEvents = [
  { id: 'ev1', title: 'Lagos Dev Summit 2026' },
  { id: 'ev2', title: 'Women in Tech Abuja' },
];

const sampleGroups = [
  { id: 'g1', name: 'Lagos Developers' },
  { id: 'g2', name: 'Naija Fintech' },
];

describe('processUSSDInput — community_menu (Branch 5)', () => {
  it('"0" from community_menu → back to main_menu', () => {
    const result = processUSSDInput(makeSession('community_menu'), '5*0');
    expect(result.session.state).toBe('main_menu');
    expect(result.ended).toBe(false);
  });

  it('"1" → community_announcements state', () => {
    const result = processUSSDInput(makeSession('community_menu'), '5*1');
    expect(result.session.state).toBe('community_announcements');
    expect(result.ended).toBe(false);
    expect(result.text).toMatch(/^CON /);
  });

  it('"2" → community_events state', () => {
    const result = processUSSDInput(makeSession('community_menu'), '5*2');
    expect(result.session.state).toBe('community_events');
    expect(result.ended).toBe(false);
    expect(result.text).toMatch(/^CON /);
  });

  it('"3" → community_groups state', () => {
    const result = processUSSDInput(makeSession('community_menu'), '5*3');
    expect(result.session.state).toBe('community_groups');
    expect(result.ended).toBe(false);
    expect(result.text).toMatch(/^CON /);
  });

  it('invalid input ends session', () => {
    const result = processUSSDInput(makeSession('community_menu'), '5*9');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('"0" from community_announcements → back to community_menu', () => {
    const result = processUSSDInput(makeSession('community_announcements'), '5*1*0');
    expect(result.session.state).toBe('community_menu');
    expect(result.ended).toBe(false);
  });

  it('invalid input from community_announcements ends session', () => {
    const result = processUSSDInput(makeSession('community_announcements'), '5*1*9');
    expect(result.text).toMatch(/^END /);
    expect(result.ended).toBe(true);
  });

  it('"0" from community_events → back to community_menu', () => {
    const result = processUSSDInput(makeSession('community_events'), '5*2*0');
    expect(result.session.state).toBe('community_menu');
    expect(result.ended).toBe(false);
  });

  it('"1" from community_events with data → ends with event title', () => {
    const session = makeSession('community_events', { communityEvents: sampleEvents });
    const result = processUSSDInput(session, '5*2*1');
    expect(result.text).toMatch(/^END /);
    expect(result.text).toContain('Lagos Dev Summit');
    expect(result.ended).toBe(true);
  });

  it('"0" from community_groups → back to community_menu', () => {
    const result = processUSSDInput(makeSession('community_groups'), '5*3*0');
    expect(result.session.state).toBe('community_menu');
    expect(result.ended).toBe(false);
  });

  it('"1" from community_groups with data → ends with group name', () => {
    const session = makeSession('community_groups', { communityGroups: sampleGroups });
    const result = processUSSDInput(session, '5*3*1');
    expect(result.text).toMatch(/^END /);
    expect(result.text).toContain('Lagos Developers');
    expect(result.ended).toBe(true);
  });

  it('community_events menu shows numbered list when data populated', () => {
    const session = makeSession('community_menu', { communityEvents: sampleEvents });
    const result = processUSSDInput(session, '5*2');
    expect(result.text).toContain('Lagos Dev Summit');
    expect(result.text).toMatch(/^CON /);
  });

  it('community_groups menu shows numbered list when data populated', () => {
    const session = makeSession('community_menu', { communityGroups: sampleGroups });
    const result = processUSSDInput(session, '5*3');
    expect(result.text).toContain('Lagos Developers');
    expect(result.text).toMatch(/^CON /);
  });
});
