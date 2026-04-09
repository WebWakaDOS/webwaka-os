/**
 * AES-256-GCM encryption helpers for DM content.
 * Platform Invariant P14 — DM Content Encrypted at Rest.
 *
 * Uses the Web Crypto API (available in both Cloudflare Workers and browsers).
 * The DM_MASTER_KEY env var must be present — absence throws at startup.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits — GCM standard

/**
 * Derive a CryptoKey from a base64-encoded master key string.
 */
async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const raw = base64ToBytes(masterKey);
  return crypto.subtle.importKey('raw', raw, { name: ALGORITHM, length: KEY_LENGTH }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv (12 bytes) + ciphertext.
 *
 * Platform Invariant P14 — called unconditionally before every DM insert.
 */
export async function encryptContent(text: string, masterKey: string): Promise<string> {
  const key = await deriveKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(text);
  const cipherBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(IV_LENGTH + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, IV_LENGTH);
  return bytesToBase64(combined);
}

/**
 * Decrypt a base64-encoded ciphertext produced by encryptContent.
 *
 * Platform Invariant P14 — called unconditionally when reading DM content.
 */
export async function decryptContent(cipher: string, masterKey: string): Promise<string> {
  const key = await deriveKey(masterKey);
  const combined = base64ToBytes(cipher);
  const iv = combined.slice(0, IV_LENGTH);
  const cipherBytes = combined.slice(IV_LENGTH);
  const plainBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuffer);
}
