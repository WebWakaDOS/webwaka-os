/**
 * Health Extended verticals aggregator router (M9–M12)
 * Mounts:
 *   /dental-clinic    — dental-clinic.ts (M9)
 *   /sports-academy   — sports-academy.ts (M10)
 *   /vet-clinic       — vet-clinic.ts (M10)
 *   /community-health — community-health.ts (M12)
 *   /elderly-care     — elderly-care.ts (M12)
 *   /rehab-centre     — rehab-centre.ts (M12)
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';

import dentalClinicRoutes from './verticals/dental-clinic.js';
import sportsAcademyRoutes from './verticals/sports-academy.js';
import vetClinicRoutes from './verticals/vet-clinic.js';
import communityHealthRoutes from './verticals/community-health.js';
import elderlyCareRoutes from './verticals/elderly-care.js';
import rehabCentreRoutes from './verticals/rehab-centre.js';

const router = new Hono<{ Bindings: Env }>();

router.route('/dental-clinic', dentalClinicRoutes);
router.route('/sports-academy', sportsAcademyRoutes);
router.route('/vet-clinic', vetClinicRoutes);
router.route('/community-health', communityHealthRoutes);
router.route('/elderly-care', elderlyCareRoutes);
router.route('/rehab-centre', rehabCentreRoutes);

export default router;
