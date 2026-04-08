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

  /** KV namespace for OTP rate limiting and channel locks (R9) */
  RATE_LIMIT_KV: KVNamespace;

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

  /**
   * Prembly API key — stored as a CF Worker Secret (M7a).
   * Used for BVN, NIN, CAC, FRSC verification.
   * Never hardcode or log this value.
   */
  PREMBLY_API_KEY: string;

  /**
   * Termii API key — stored as a CF Worker Secret (M7a).
   * Used for SMS OTP delivery on Nigerian networks.
   * Never hardcode or log this value.
   */
  TERMII_API_KEY: string;

  /**
   * Meta/WhatsApp Business API access token (M7a).
   * Used for WhatsApp OTP delivery via Meta Cloud API v18.
   * Never hardcode or log this value.
   */
  WHATSAPP_ACCESS_TOKEN: string;

  /**
   * WhatsApp Business phone number ID (M7a).
   * The business number registered in Meta Business Manager.
   */
  WHATSAPP_PHONE_NUMBER_ID: string;

  /**
   * Telegram Bot API token (M7a).
   * Used for Telegram OTP delivery.
   * Never hardcode or log this value.
   */
  TELEGRAM_BOT_TOKEN: string;

  /**
   * Salt for hashing PII (BVN, NIN, phone) before storage (M7a).
   * Security Baseline R7: SHA-256(SALT + value) — never store raw BVN/NIN.
   * Never hardcode or log this value.
   */
  LOG_PII_SALT: string;

  /**
   * AES-GCM master key for DM encryption (M7c).
   * Platform Invariant P14 — assertDMMasterKey called at startup.
   * Never hardcode or log this value.
   */
  DM_MASTER_KEY: string;

  /**
   * Comma-separated list of allowed CORS origins (M7b advisory fix).
   * Example: "https://app.webwaka.com,https://admin.webwaka.com"
   * Set via CF Dashboard / wrangler secret put ALLOWED_ORIGINS
   * Falls back to ['https://*.webwaka.com'] in production if not set.
   */
  ALLOWED_ORIGINS?: string;
}
