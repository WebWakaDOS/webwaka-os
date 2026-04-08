/**
 * Community courses — modules, lessons, progress.
 * T3 — every query carries tenant_id predicate.
 * P6 — lessons are offline-cacheable (GET /community/lessons/:id).
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

export interface CourseModule {
  id: string;
  tenantId: string;
  communityId: string;
  title: string;
  sortOrder: number;
  createdAt: number;
}

interface ModuleRow {
  id: string;
  tenant_id: string;
  community_id: string;
  title: string;
  sort_order: number;
  created_at: number;
}

function rowToModule(row: ModuleRow): CourseModule {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    communityId: row.community_id,
    title: row.title,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export interface CourseLesson {
  id: string;
  tenantId: string;
  moduleId: string;
  title: string;
  body: string | null;
  contentType: string;
  sortOrder: number;
  createdAt: number;
}

interface LessonRow {
  id: string;
  tenant_id: string;
  module_id: string;
  title: string;
  body: string | null;
  content_type: string;
  sort_order: number;
  created_at: number;
}

function rowToLesson(row: LessonRow): CourseLesson {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    moduleId: row.module_id,
    title: row.title,
    body: row.body,
    contentType: row.content_type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export interface LessonProgress {
  id: string;
  tenantId: string;
  lessonId: string;
  userId: string;
  progressPct: number;
  completed: boolean;
  updatedAt: number;
}

interface ProgressRow {
  id: string;
  tenant_id: string;
  lesson_id: string;
  user_id: string;
  progress_pct: number;
  completed: number;
  updated_at: number;
}

function rowToProgress(row: ProgressRow): LessonProgress {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    lessonId: row.lesson_id,
    userId: row.user_id,
    progressPct: row.progress_pct,
    completed: row.completed === 1,
    updatedAt: row.updated_at,
  };
}

export async function createCourseModule(
  db: D1Like,
  args: { communityId: string; title: string; sortOrder?: number; tenantId: string },
): Promise<CourseModule> {
  const { communityId, title, sortOrder = 0, tenantId } = args;
  const id = `mod_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO course_modules (id, tenant_id, community_id, title, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, communityId, title, sortOrder, now)
    .run();

  return { id, tenantId, communityId, title, sortOrder, createdAt: now };
}

export async function getCourseModules(
  db: D1Like,
  communityId: string,
  tenantId: string,
): Promise<CourseModule[]> {
  const result = await db
    .prepare(
      'SELECT * FROM course_modules WHERE community_id = ? AND tenant_id = ? ORDER BY sort_order ASC',
    )
    .bind(communityId, tenantId)
    .all<ModuleRow>();

  return result.results.map(rowToModule);
}

export async function createCourseLesson(
  db: D1Like,
  args: {
    moduleId: string;
    title: string;
    body?: string;
    contentType?: string;
    sortOrder?: number;
    tenantId: string;
  },
): Promise<CourseLesson> {
  const { moduleId, title, body, contentType = 'text', sortOrder = 0, tenantId } = args;
  const id = `ls_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO course_lessons (id, tenant_id, module_id, title, body, content_type, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, moduleId, title, body ?? null, contentType, sortOrder, now)
    .run();

  return { id, tenantId, moduleId, title, body: body ?? null, contentType, sortOrder, createdAt: now };
}

export async function getLessonById(
  db: D1Like,
  lessonId: string,
  tenantId: string,
): Promise<CourseLesson | null> {
  const row = await db
    .prepare('SELECT * FROM course_lessons WHERE id = ? AND tenant_id = ?')
    .bind(lessonId, tenantId)
    .first<LessonRow>();

  return row ? rowToLesson(row) : null;
}

export async function recordLessonProgress(
  db: D1Like,
  args: {
    lessonId: string;
    userId: string;
    progressPct: number;
    tenantId: string;
  },
): Promise<LessonProgress> {
  const { lessonId, userId, progressPct, tenantId } = args;

  if (!Number.isInteger(progressPct) || progressPct < 0 || progressPct > 100) {
    throw new Error('VALIDATION: progressPct must be an integer between 0 and 100');
  }

  const id = `lp_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);
  const completed = progressPct === 100 ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO lesson_progress (id, tenant_id, lesson_id, user_id, progress_pct, completed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, lesson_id, tenant_id) DO UPDATE SET
         progress_pct = excluded.progress_pct,
         completed = excluded.completed,
         updated_at = excluded.updated_at`,
    )
    .bind(id, tenantId, lessonId, userId, progressPct, completed, now)
    .run();

  return {
    id,
    tenantId,
    lessonId,
    userId,
    progressPct,
    completed: completed === 1,
    updatedAt: now,
  };
}
