/**
 * Cloudflare Worker environment bindings type definition.
 * All bindings must be declared here and referenced as `Env` throughout the app.
 *
 * Bindings are provisioned via wrangler.toml + CF Dashboard secrets.
 * Never hardcode secrets — use CF Worker Secrets.
 */

export interface Env {
  /** Main D1 database binding */
  DB: D1Database;

  /** KV namespace for caching the geography index */
  GEOGRAPHY_CACHE: KVNamespace;

  /** JWT secret — stored as a CF Worker Secret. Never log this. */
  JWT_SECRET: string;

  /** Runtime environment tag */
  ENVIRONMENT: 'development' | 'staging' | 'production';

  /**
   * Paystack secret key — stored as a CF Worker Secret.
   * Provisioned via CF Dashboard / wrangler secret put PAYSTACK_SECRET_KEY
   * Never hardcode or log this value.
   */
  PAYSTACK_SECRET_KEY: string;
}
