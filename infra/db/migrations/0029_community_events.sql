-- Migration: 0029_community_events
-- Milestone 7c: Community Platform
-- Tables: community_events, event_rsvps

-- T4 — ticket_price_kobo is INTEGER, never REAL/FLOAT

CREATE TABLE IF NOT EXISTS community_events (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  community_id      TEXT NOT NULL,
  title             TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'live',
  starts_at         INTEGER NOT NULL,
  ticket_price_kobo INTEGER NOT NULL DEFAULT 0,
  max_attendees     INTEGER NOT NULL DEFAULT -1,
  rsvp_count        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_community_events_community
  ON community_events(community_id, tenant_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_community_events_tenant
  ON community_events(tenant_id, starts_at);

-- ---------------------------------------------------------------------------
-- RSVPs (409 if event full, 402 if ticket_price_kobo > 0 without payment)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_rsvps (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  event_id         TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'confirmed',
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rsvps_user_event
  ON event_rsvps(user_id, event_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event
  ON event_rsvps(event_id, tenant_id);
