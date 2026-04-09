/**
 * Commerce P2 Batch 2 — Combined Router
 * M9/M10 Set B (12 verticals)
 *
 * Mounts all 12 Commerce P2 Batch 2 vertical routers under their canonical slugs.
 * This combined router is mounted at /api/v1 in apps/api/src/index.ts.
 *
 * Routes:
 *   /construction/...
 *   /fuel-station/...
 *   /print-shop/...
 *   /property-developer/...
 *   /real-estate-agency/...
 *   /restaurant-chain/...
 *   /security-company/...
 *   /solar-installer/...
 *   /spa/...
 *   /tailor/...
 *   /travel-agent/...
 *   /welding-fabrication/...
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';
import { constructionRoutes } from './verticals/construction.js';
import { fuelStationRoutes } from './verticals/fuel-station.js';
import { printShopRoutes } from './verticals/print-shop.js';
import { propertyDeveloperRoutes } from './verticals/property-developer.js';
import { realEstateAgencyRoutes } from './verticals/real-estate-agency.js';
import { restaurantChainRoutes } from './verticals/restaurant-chain.js';
import { securityCompanyRoutes } from './verticals/security-company.js';
import { solarInstallerRoutes } from './verticals/solar-installer.js';
import { spaRoutes } from './verticals/spa.js';
import { tailorRoutes } from './verticals/tailor.js';
import { travelAgentRoutes } from './verticals/travel-agent.js';
import { weldingFabricationRoutes } from './verticals/welding-fabrication.js';

export const commerceP2Batch2Routes = new Hono<{ Bindings: Env }>();

commerceP2Batch2Routes.route('/construction', constructionRoutes);
commerceP2Batch2Routes.route('/fuel-station', fuelStationRoutes);
commerceP2Batch2Routes.route('/print-shop', printShopRoutes);
commerceP2Batch2Routes.route('/property-developer', propertyDeveloperRoutes);
commerceP2Batch2Routes.route('/real-estate-agency', realEstateAgencyRoutes);
commerceP2Batch2Routes.route('/restaurant-chain', restaurantChainRoutes);
commerceP2Batch2Routes.route('/security-company', securityCompanyRoutes);
commerceP2Batch2Routes.route('/solar-installer', solarInstallerRoutes);
commerceP2Batch2Routes.route('/spa', spaRoutes);
commerceP2Batch2Routes.route('/tailor', tailorRoutes);
commerceP2Batch2Routes.route('/travel-agent', travelAgentRoutes);
commerceP2Batch2Routes.route('/welding-fabrication', weldingFabricationRoutes);
