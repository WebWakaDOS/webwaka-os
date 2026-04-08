-- Migration: 0028_community_courses
-- Milestone 7c: Community Platform
-- Tables: course_modules, course_lessons, lesson_progress

CREATE TABLE IF NOT EXISTS course_modules (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  community_id     TEXT NOT NULL,
  title            TEXT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_course_modules_community
  ON course_modules(community_id, tenant_id, sort_order);

-- ---------------------------------------------------------------------------
-- Lessons (offline-cacheable per P6 — GET /community/lessons/:id)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_lessons (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  module_id        TEXT NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT,
  content_type     TEXT NOT NULL DEFAULT 'text',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_module
  ON course_lessons(module_id, tenant_id, sort_order);

-- ---------------------------------------------------------------------------
-- Lesson progress (T3 — tenant_id on every query)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lesson_progress (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  lesson_id        TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  progress_pct     INTEGER NOT NULL DEFAULT 0,
  completed        INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson
  ON lesson_progress(user_id, lesson_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson
  ON lesson_progress(lesson_id, tenant_id);
