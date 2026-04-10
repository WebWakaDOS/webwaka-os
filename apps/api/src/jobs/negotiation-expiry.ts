// Negotiation Expiry CRON Job
// Scheduled trigger: every 15 minutes (cron pattern: star-slash-15 star star star star)
// Configured in wrangler.toml [[triggers]]
//
// Sweeps all tenants for open negotiation sessions past their expiry time.
// Also cleans up accepted sessions with no payment after 24 hours.
// Idempotent: re-running has no adverse effect.
// Errors are caught and logged — handler never crashes the Worker.
//
// OPS-004 fix: audit entries now use session.tenant_id (the real tenant),
// not the hardcoded 'system' string which violated T3.

import { NegotiationRepository } from '@webwaka/negotiation';
import type { Env } from '../env.js';

export async function runNegotiationExpiry(env: Env): Promise<void> {
  const repo = new NegotiationRepository(env.DB);
  const now = Math.floor(Date.now() / 1000);

  try {
    const expiredCount = await repo.expireOpenSessions();
    console.log(`[negotiation-expiry] Expired ${expiredCount} open sessions`);

    if (expiredCount > 0) {
      const recentCutoff = now - 60;
      // OPS-004: fetch full sessions (with tenant_id) instead of bare IDs
      const expiredSessions = await repo.expiredSessions(recentCutoff);
      for (const session of expiredSessions) {
        try {
          await repo.writeAuditEntry({
            tenant_id: session.tenant_id, // T3: use real tenant from session, not 'system'
            session_id: session.id,
            event_type: 'expired',
            actor_type: 'system',
            actor_ref_id: 'system',
          });
        } catch {
          // Audit failure must not halt the sweep
        }
      }
    }
  } catch (err) {
    console.error('[negotiation-expiry] Expiry sweep failed (non-fatal):', err);
  }

  const cutoff24h = now - 86400;
  try {
    const abandoned = await repo.abandonedAcceptedSessions(cutoff24h);
    for (const session of abandoned) {
      try {
        await repo.updateSessionStatus(session.id, session.tenant_id, 'cancelled');
        await repo.writeAuditEntry({
          tenant_id: session.tenant_id,
          session_id: session.id,
          event_type: 'cancelled',
          actor_type: 'system',
          actor_ref_id: 'system',
          metadata: { reason: 'payment_timeout_24h' },
        });
        console.log(`[negotiation-expiry] Cancelled abandoned accepted session: ${session.id}`);
      } catch (err) {
        console.error(`[negotiation-expiry] Failed to cancel session ${session.id}:`, err);
      }
    }
    if (abandoned.length > 0) {
      console.log(`[negotiation-expiry] Cleaned up ${abandoned.length} abandoned accepted sessions`);
    }
  } catch (err) {
    console.error('[negotiation-expiry] Abandoned session cleanup failed (non-fatal):', err);
  }
}
