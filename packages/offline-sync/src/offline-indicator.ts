/**
 * Offline indicator — ENH-37 visibility.
 * Observes navigator.onLine and window online/offline events.
 *
 * Browser/PWA only.
 */

export type NetworkState = 'online' | 'offline';

/**
 * Subscribe to network state changes.
 * Returns a cleanup function — call it to remove event listeners.
 */
export function observeNetworkState(
  onStateChange: (state: NetworkState) => void,
): () => void {
  const handleOnline = (): void => onStateChange('online');
  const handleOffline = (): void => onStateChange('offline');

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Emit initial state
  onStateChange(navigator.onLine ? 'online' : 'offline');

  return (): void => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * One-shot check of current network state.
 */
export function getNetworkState(): NetworkState {
  return navigator.onLine ? 'online' : 'offline';
}
