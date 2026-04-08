/**
 * Community channels and channel posts.
 * P15 — classifyContent called unconditionally before every channel post insert.
 * T3 — every query carries tenant_id predicate.
 */

import { classifyContent } from './moderation.js';

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

export interface CommunityChannel {
  id: string;
  tenantId: string;
  communityId: string;
  name: string;
  type: 'discussion' | 'announcement' | 'course';
  createdAt: number;
}

interface ChannelRow {
  id: string;
  tenant_id: string;
  community_id: string;
  name: string;
  type: string;
  created_at: number;
}

function rowToChannel(row: ChannelRow): CommunityChannel {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    communityId: row.community_id,
    name: row.name,
    type: row.type as 'discussion' | 'announcement' | 'course',
    createdAt: row.created_at,
  };
}

export interface CreateChannelArgs {
  communityId: string;
  name: string;
  type?: 'discussion' | 'announcement' | 'course';
  tenantId: string;
}

export async function createChannel(
  db: D1Like,
  args: CreateChannelArgs,
): Promise<CommunityChannel> {
  const { communityId, name, type = 'discussion', tenantId } = args;
  const id = `ch_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO community_channels (id, tenant_id, community_id, name, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, communityId, name, type, now)
    .run();

  return { id, tenantId, communityId, name, type, createdAt: now };
}

export async function listChannels(
  db: D1Like,
  communityId: string,
  tenantId: string,
): Promise<CommunityChannel[]> {
  const result = await db
    .prepare('SELECT * FROM community_channels WHERE community_id = ? AND tenant_id = ?')
    .bind(communityId, tenantId)
    .all<ChannelRow>();

  return result.results.map(rowToChannel);
}

export interface ChannelPost {
  id: string;
  tenantId: string;
  channelId: string;
  authorId: string;
  content: string;
  moderationStatus: 'published' | 'auto_hide' | 'pending_review';
  isDeleted: boolean;
  createdAt: number;
}

interface ChannelPostRow {
  id: string;
  tenant_id: string;
  channel_id: string;
  author_id: string;
  content: string;
  moderation_status: string;
  is_deleted: number;
  created_at: number;
}

function rowToPost(row: ChannelPostRow): ChannelPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channelId: row.channel_id,
    authorId: row.author_id,
    content: row.content,
    moderationStatus: row.moderation_status as 'published' | 'auto_hide' | 'pending_review',
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
  };
}

export interface CreateChannelPostArgs {
  channelId: string;
  authorId: string;
  content: string;
  tenantId: string;
}

/**
 * Create a channel post.
 * P15 — classifyContent is called unconditionally before the INSERT.
 */
export async function createChannelPost(
  db: D1Like,
  args: CreateChannelPostArgs,
): Promise<ChannelPost> {
  const { channelId, authorId, content, tenantId } = args;

  if (!content || content.trim().length === 0) {
    throw new Error('VALIDATION: content must not be empty');
  }

  const moderation = classifyContent(content);

  const id = `cp_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO channel_posts (id, tenant_id, channel_id, author_id, content, moderation_status, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    )
    .bind(id, tenantId, channelId, authorId, content, moderation.status, now)
    .run();

  return {
    id,
    tenantId,
    channelId,
    authorId,
    content,
    moderationStatus: moderation.status,
    isDeleted: false,
    createdAt: now,
  };
}

export async function listChannelPosts(
  db: D1Like,
  channelId: string,
  tenantId: string,
  limit = 50,
  offset = 0,
): Promise<ChannelPost[]> {
  const result = await db
    .prepare(
      'SELECT * FROM channel_posts WHERE channel_id = ? AND tenant_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
    .bind(channelId, tenantId, limit, offset)
    .all<ChannelPostRow>();

  return result.results.map(rowToPost);
}
