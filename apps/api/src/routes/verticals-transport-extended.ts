/**
 * Transport Extended router — 8 verticals (M9/M12)
 *
 * Verticals: clearing-agent, courier, dispatch-rider, airport-shuttle,
 *            cargo-truck, container-depot, ferry, nurtw
 *
 * All routes prefixed at /api/v1/{slug}/*
 * Auth middleware registered per-slug in apps/api/src/index.ts
 * Platform Invariants: T3, P9, P12, P13
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';
import { clearingAgentRoutes } from './verticals/clearing-agent.js';
import { courierRoutes } from './verticals/courier.js';
import { dispatchRiderRoutes } from './verticals/dispatch-rider.js';
import { airportShuttleRoutes } from './verticals/airport-shuttle.js';
import { cargoTruckRoutes } from './verticals/cargo-truck.js';
import { containerDepotRoutes } from './verticals/container-depot.js';
import { ferryRoutes } from './verticals/ferry.js';
import { nurtwRoutes } from './verticals/nurtw.js';

export const transportExtendedRoutes = new Hono<{ Bindings: Env }>();

transportExtendedRoutes.route('/clearing-agent', clearingAgentRoutes);
transportExtendedRoutes.route('/courier', courierRoutes);
transportExtendedRoutes.route('/dispatch-rider', dispatchRiderRoutes);
transportExtendedRoutes.route('/airport-shuttle', airportShuttleRoutes);
transportExtendedRoutes.route('/cargo-truck', cargoTruckRoutes);
transportExtendedRoutes.route('/container-depot', containerDepotRoutes);
transportExtendedRoutes.route('/ferry', ferryRoutes);
transportExtendedRoutes.route('/nurtw', nurtwRoutes);
