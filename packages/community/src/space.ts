/**
 * Community space CRUD.
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

export interface CommunitySpace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'public' | 'private';
  memberCount: number;
  createdAt: number;
}

interface SpaceRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  member_count: number;
  created_at: number;
}

function rowToSpace(row: SpaceRow): CommunitySpace {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    visibility: row.visibility as 'public' | 'private',
    memberCount: row.member_count,
    createdAt: row.created_at,
  };
}

export interface CreateCommunitySpaceArgs {
  name: string;
  slug: string;
  description?: string;
  visibility?: 'public' | 'private';
  tenantId: string;
}

export async function createCommunitySpace(
  db: D1Like,
  args: CreateCommunitySpaceArgs,
): Promise<CommunitySpace> {
  const { name, slug, description, visibility = 'public', tenantId } = args;

  const existing = await db
    .prepare('SELECT id FROM community_spaces WHERE slug = ? AND tenant_id = ?')
    .bind(slug, tenantId)
    .first<{ id: string }>();

  if (existing) {
    throw new Error('SLUG_TAKEN: A community with this slug already exists in this tenant');
  }

  const id = `cs_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO community_spaces (id, tenant_id, name, slug, description, visibility, member_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
    )
    .bind(id, tenantId, name, slug, description ?? null, visibility, now, now)
    .run();

  return {
    id,
    tenantId,
    name,
    slug,
    description: description ?? null,
    visibility,
    memberCount: 0,
    createdAt: now,
  };
}

export async function getCommunitySpace(
  db: D1Like,
  slug: string,
  tenantId: string,
): Promise<CommunitySpace | null> {
  const row = await db
    .prepare('SELECT * FROM community_spaces WHERE slug = ? AND tenant_id = ?')
    .bind(slug, tenantId)
    .first<SpaceRow>();

  return row ? rowToSpace(row) : null;
}

export async function listSpaces(
  db: D1Like,
  tenantId: string,
): Promise<CommunitySpace[]> {
  const result = await db
    .prepare('SELECT * FROM community_spaces WHERE tenant_id = ? ORDER BY created_at DESC')
    .bind(tenantId)
    .all<SpaceRow>();

  return result.results.map(rowToSpace);
}
