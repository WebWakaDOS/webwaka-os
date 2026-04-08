/**
 * Direct messages with AES-GCM encryption.
 * P14 — DM_MASTER_KEY must throw at startup if absent.
 *       Content stored encrypted — NO plaintext content column.
 * T3 — every query carries tenant_id predicate.
 */

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

/**
 * Assert that the DM master key is present and non-empty.
 * P14 — throws if key is undefined or empty string.
 */
export function assertDMMasterKey(key: string | undefined): asserts key is string {
  if (key === undefined || key === null || key.length === 0) {
    throw new Error('P14_VIOLATION: DM_MASTER_KEY is required but was not provided');
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function deriveMasterKey(masterKeyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(masterKeyString.padEnd(32, '0').slice(0, 32));
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt plaintext with AES-GCM using the master key.
 * Returns { encryptedContent, iv } — both as base64 strings.
 */
async function encryptDMContent(
  plaintext: string,
  masterKey: string,
): Promise<{ encryptedContent: string; iv: string }> {
  const key = await deriveMasterKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );
  return {
    encryptedContent: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt AES-GCM ciphertext.
 */
export async function decryptDMContent(
  encryptedContent: string,
  ivBase64: string,
  masterKey: string,
): Promise<string> {
  const key = await deriveMasterKey(masterKey);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToArrayBuffer(encryptedContent),
  );
  return new TextDecoder().decode(decrypted);
}

export interface DMThread {
  id: string;
  tenantId: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface ThreadRow {
  id: string;
  tenant_id: string;
  created_at: number;
  updated_at: number;
}

interface ParticipantRow {
  user_id: string;
}

export interface DMMessage {
  id: string;
  tenantId: string;
  threadId: string;
  senderId: string;
  encryptedContent: string;
  iv: string;
  createdAt: number;
}

interface MessageRow {
  id: string;
  tenant_id: string;
  thread_id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  created_at: number;
}

/**
 * Create a DM thread.
 * Throws if fewer than 2 participants provided.
 */
export async function createDMThread(
  db: D1Like,
  args: { participantIds: string[]; tenantId: string },
): Promise<DMThread> {
  const { participantIds, tenantId } = args;

  if (participantIds.length < 2) {
    throw new Error('VALIDATION: DM thread requires at least 2 participants');
  }

  const threadId = `dmt_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO dm_threads (id, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    .bind(threadId, tenantId, now, now)
    .run();

  for (const userId of participantIds) {
    const partId = `dmp_${crypto.randomUUID().replace(/-/g, '')}`;
    await db
      .prepare(
        'INSERT INTO dm_thread_participants (id, tenant_id, thread_id, user_id, joined_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(partId, tenantId, threadId, userId, now)
      .run();
  }

  return { id: threadId, tenantId, participantIds, createdAt: now, updatedAt: now };
}

/**
 * Send a DM.
 * P14 — content is encrypted with AES-GCM before storage.
 */
export async function sendDM(
  db: D1Like,
  args: {
    threadId: string;
    senderId: string;
    content: string;
    masterKey: string;
    tenantId: string;
  },
): Promise<DMMessage> {
  const { threadId, senderId, content, masterKey, tenantId } = args;

  assertDMMasterKey(masterKey);

  const { encryptedContent, iv } = await encryptDMContent(content, masterKey);

  const msgId = `dmm_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO dm_messages (id, tenant_id, thread_id, sender_id, encrypted_content, iv, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(msgId, tenantId, threadId, senderId, encryptedContent, iv, now)
    .run();

  await db
    .prepare('UPDATE dm_threads SET updated_at = ? WHERE id = ? AND tenant_id = ?')
    .bind(now, threadId, tenantId)
    .run();

  return { id: msgId, tenantId, threadId, senderId, encryptedContent, iv, createdAt: now };
}

export async function getDMThreads(
  db: D1Like,
  userId: string,
  tenantId: string,
): Promise<DMThread[]> {
  const result = await db
    .prepare(
      `SELECT t.* FROM dm_threads t
       JOIN dm_thread_participants p ON p.thread_id = t.id AND p.tenant_id = t.tenant_id
       WHERE p.user_id = ? AND t.tenant_id = ?
       ORDER BY t.updated_at DESC`,
    )
    .bind(userId, tenantId)
    .all<ThreadRow>();

  const threads: DMThread[] = [];
  for (const row of result.results) {
    const parts = await db
      .prepare(
        'SELECT user_id FROM dm_thread_participants WHERE thread_id = ? AND tenant_id = ?',
      )
      .bind(row.id, tenantId)
      .all<ParticipantRow>();

    threads.push({
      id: row.id,
      tenantId: row.tenant_id,
      participantIds: parts.results.map((p) => p.user_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return threads;
}

export async function getDMMessages(
  db: D1Like,
  threadId: string,
  tenantId: string,
  limit = 50,
): Promise<DMMessage[]> {
  const result = await db
    .prepare(
      'SELECT * FROM dm_messages WHERE thread_id = ? AND tenant_id = ? ORDER BY created_at ASC LIMIT ?',
    )
    .bind(threadId, tenantId, limit)
    .all<MessageRow>();

  return result.results.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    encryptedContent: row.encrypted_content,
    iv: row.iv,
    createdAt: row.created_at,
  }));
}
