/**
 * Financial + Place + Media + Institutional Extended verticals aggregator router
 * Mounts:
 *   Financial (4):
 *   /airtime-reseller      — M12 — NCC/CBN, daily cap 30M kobo, L2 AI
 *   /bureau-de-change      — M12 — CBN BDC, FX rates kobo/cent (no floats), L2 AI, Tier 3 KYC
 *   /hire-purchase         — M12 — CBN consumer credit, outstanding_kobo decrement, L2 AI, Tier 3 KYC
 *   /mobile-money-agent    — M12 — CBN agent, float daily cap 30M kobo, L2 AI, Tier 3 KYC
 *
 *   Place (4):
 *   /event-hall            — M10 — state licence, double-booking prevention, L2 AI
 *   /water-treatment       — M11 — NAFDAC, scaled integers ph×100/ppm×10/NTU×10, L2 AI
 *   /community-hall        — M12 — 3-state FSM, L1 AI
 *   /events-centre         — M12 — state licence, section conflict check, L2 AI
 *
 *   Media (3):
 *   /advertising-agency    — M9  — APCON, impressions INTEGER, CPM kobo, L2 AI
 *   /newspaper-dist        — M12 — NPC, print_run integer copies, L2 AI
 *   /podcast-studio        — M12 — CAC, L3 HITL for broadcast scheduling, L2 sponsorship
 *
 *   Institutional (2):
 *   /government-agency     — M11 — BPP, L3 HITL ALL AI, Tier 3 KYC, vendor P13
 *   /polling-unit          — M12 — INEC, L3 HITL ALL AI, NO voter PII (absolute)
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';

import airtimeResellerRoutes from './verticals/airtime-reseller.js';
import bureauDeChangeRoutes from './verticals/bureau-de-change.js';
import hirePurchaseRoutes from './verticals/hire-purchase.js';
import mobileMoneyAgentRoutes from './verticals/mobile-money-agent.js';
import eventHallRoutes from './verticals/event-hall.js';
import waterTreatmentRoutes from './verticals/water-treatment.js';
import communityHallRoutes from './verticals/community-hall.js';
import eventsCentreRoutes from './verticals/events-centre.js';
import advertisingAgencyRoutes from './verticals/advertising-agency.js';
import newspaperDistRoutes from './verticals/newspaper-dist.js';
import podcastStudioRoutes from './verticals/podcast-studio.js';
import governmentAgencyRoutes from './verticals/government-agency.js';
import pollingUnitRoutes from './verticals/polling-unit.js';

const router = new Hono<{ Bindings: Env }>();

router.route('/airtime-reseller', airtimeResellerRoutes);
router.route('/bureau-de-change', bureauDeChangeRoutes);
router.route('/hire-purchase', hirePurchaseRoutes);
router.route('/mobile-money-agent', mobileMoneyAgentRoutes);
router.route('/event-hall', eventHallRoutes);
router.route('/water-treatment', waterTreatmentRoutes);
router.route('/community-hall', communityHallRoutes);
router.route('/events-centre', eventsCentreRoutes);
router.route('/advertising-agency', advertisingAgencyRoutes);
router.route('/newspaper-dist', newspaperDistRoutes);
router.route('/podcast-studio', podcastStudioRoutes);
router.route('/government-agency', governmentAgencyRoutes);
router.route('/polling-unit', pollingUnitRoutes);

export default router;
