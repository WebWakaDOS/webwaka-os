/**
 * Community events and RSVPs.
 * T3 — every query carries tenant_id predicate.
 * T4 — ticketPriceKobo must be a non-negative integer (never float).
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

export interface CommunityEvent {
  id: string;
  tenantId: string;
  communityId: string;
  title: string;
  type: 'live' | 'recorded' | 'in_person';
  startsAt: number;
  ticketPriceKobo: number;
  maxAttendees: number;
  rsvpCount: number;
  createdAt: number;
}

interface EventRow {
  id: string;
  tenant_id: string;
  community_id: string;
  title: string;
  type: string;
  starts_at: number;
  ticket_price_kobo: number;
  max_attendees: number;
  rsvp_count: number;
  created_at: number;
}

function rowToEvent(row: EventRow): CommunityEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    communityId: row.community_id,
    title: row.title,
    type: row.type as 'live' | 'recorded' | 'in_person',
    startsAt: row.starts_at,
    ticketPriceKobo: row.ticket_price_kobo,
    maxAttendees: row.max_attendees,
    rsvpCount: row.rsvp_count,
    createdAt: row.created_at,
  };
}

export interface CreateEventArgs {
  communityId: string;
  title: string;
  type?: 'live' | 'recorded' | 'in_person';
  startsAt: number;
  ticketPriceKobo?: number;
  maxAttendees?: number;
  tenantId: string;
}

/**
 * Create a community event.
 * T4 — ticketPriceKobo must be a non-negative integer.
 */
export async function createEvent(db: D1Like, args: CreateEventArgs): Promise<CommunityEvent> {
  const {
    communityId,
    title,
    type = 'live',
    startsAt,
    ticketPriceKobo = 0,
    maxAttendees = -1,
    tenantId,
  } = args;

  if (!Number.isInteger(ticketPriceKobo) || ticketPriceKobo < 0) {
    throw new Error(
      'T4_VIOLATION: ticketPriceKobo must be a non-negative integer (use integer kobo, never floats)',
    );
  }

  const id = `ev_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO community_events (id, tenant_id, community_id, title, type, starts_at, ticket_price_kobo, max_attendees, rsvp_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
    )
    .bind(id, tenantId, communityId, title, type, startsAt, ticketPriceKobo, maxAttendees, now)
    .run();

  return {
    id,
    tenantId,
    communityId,
    title,
    type,
    startsAt,
    ticketPriceKobo,
    maxAttendees,
    rsvpCount: 0,
    createdAt: now,
  };
}

export async function listEvents(
  db: D1Like,
  communityId: string,
  tenantId: string,
): Promise<CommunityEvent[]> {
  const result = await db
    .prepare(
      'SELECT * FROM community_events WHERE community_id = ? AND tenant_id = ? ORDER BY starts_at ASC',
    )
    .bind(communityId, tenantId)
    .all<EventRow>();

  return result.results.map(rowToEvent);
}

export interface EventRsvp {
  id: string;
  tenantId: string;
  eventId: string;
  userId: string;
  status: string;
  createdAt: number;
}

interface RsvpRow {
  id: string;
  tenant_id: string;
  event_id: string;
  user_id: string;
  status: string;
  created_at: number;
}

interface EventCountRow {
  rsvp_count: number;
  max_attendees: number;
  ticket_price_kobo: number;
}

/**
 * RSVP to an event.
 * Throws PAYMENT_REQUIRED if ticket_price_kobo > 0.
 * Throws EVENT_FULL if max_attendees reached.
 */
export async function rsvpToEvent(
  db: D1Like,
  args: { eventId: string; userId: string; tenantId: string },
): Promise<EventRsvp> {
  const { eventId, userId, tenantId } = args;

  const event = await db
    .prepare('SELECT rsvp_count, max_attendees, ticket_price_kobo FROM community_events WHERE id = ? AND tenant_id = ?')
    .bind(eventId, tenantId)
    .first<EventCountRow>();

  if (!event) {
    throw new Error('NOT_FOUND: Event not found');
  }

  if (event.ticket_price_kobo > 0) {
    throw new Error('PAYMENT_REQUIRED: This event requires a ticket purchase');
  }

  if (event.max_attendees !== -1 && event.rsvp_count >= event.max_attendees) {
    throw new Error('EVENT_FULL: This event has reached maximum capacity');
  }

  const id = `rsvp_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO event_rsvps (id, tenant_id, event_id, user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, eventId, userId, 'confirmed', now)
    .run();

  return { id, tenantId, eventId, userId, status: 'confirmed', createdAt: now };
}
