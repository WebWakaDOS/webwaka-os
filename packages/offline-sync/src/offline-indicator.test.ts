/**
 * Tests for offline-indicator — network state observation (ENH-37).
 * Uses jsdom environment (see vitest.config.ts).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { observeNetworkState, getNetworkState } from './offline-indicator.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('observeNetworkState', () => {
  it('calls onStateChange immediately with current state (online)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const spy = vi.fn();
    const cleanup = observeNetworkState(spy);
    expect(spy).toHaveBeenCalledWith('online');
    cleanup();
  });

  it('calls onStateChange immediately with current state (offline)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const spy = vi.fn();
    const cleanup = observeNetworkState(spy);
    expect(spy).toHaveBeenCalledWith('offline');
    cleanup();
  });

  it('calls onStateChange with "offline" on offline event', () => {
    const spy = vi.fn();
    const cleanup = observeNetworkState(spy);
    spy.mockClear();
    window.dispatchEvent(new Event('offline'));
    expect(spy).toHaveBeenCalledWith('offline');
    cleanup();
  });

  it('calls onStateChange with "online" on online event', () => {
    const spy = vi.fn();
    const cleanup = observeNetworkState(spy);
    spy.mockClear();
    window.dispatchEvent(new Event('online'));
    expect(spy).toHaveBeenCalledWith('online');
    cleanup();
  });

  it('returns cleanup function that removes event listeners', () => {
    const spy = vi.fn();
    const cleanup = observeNetworkState(spy);
    spy.mockClear();
    cleanup();
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    // No new calls after cleanup
    expect(spy).not.toHaveBeenCalled();
  });

  it('supports multiple independent subscribers', () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const c1 = observeNetworkState(spy1);
    const c2 = observeNetworkState(spy2);
    spy1.mockClear();
    spy2.mockClear();
    window.dispatchEvent(new Event('offline'));
    expect(spy1).toHaveBeenCalledWith('offline');
    expect(spy2).toHaveBeenCalledWith('offline');
    c1();
    c2();
  });
});

describe('getNetworkState', () => {
  it('returns "online" when navigator.onLine is true', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(getNetworkState()).toBe('online');
  });

  it('returns "offline" when navigator.onLine is false', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(getNetworkState()).toBe('offline');
  });
});
