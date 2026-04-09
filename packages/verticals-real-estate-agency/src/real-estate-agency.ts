import type { RealEstateAgencyProfile, CreateRealEstateAgencyInput, UpdateRealEstateAgencyInput, RealEstateAgencyFSMState, PropertyListing, CreatePropertyListingInput, ListingStatus, PropertyEnquiry, CreatePropertyEnquiryInput, EnquiryStatus, PropertyCommission, CreatePropertyCommissionInput, CommissionStatus } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, agency_name, niesv_number, esvarbon_number, cac_number, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): RealEstateAgencyProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, agencyName: r['agency_name'] as string, niesvNumber: r['niesv_number'] as string | null, esvarbonNumber: r['esvarbon_number'] as string | null, cacNumber: r['cac_number'] as string | null, status: r['status'] as RealEstateAgencyFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const LISTING_COLS = 'id, workspace_id, tenant_id, title, type, transaction_type, state, lga, address, price_kobo, bedrooms, bathrooms, status, created_at, updated_at';
function rowToListing(r: Record<string, unknown>): PropertyListing {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, title: r['title'] as string, type: r['type'] as PropertyListing['type'], transactionType: r['transaction_type'] as PropertyListing['transactionType'], state: r['state'] as string | null, lga: r['lga'] as string | null, address: r['address'] as string | null, priceKobo: r['price_kobo'] as number, bedrooms: r['bedrooms'] as number | null, bathrooms: r['bathrooms'] as number | null, status: r['status'] as ListingStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const ENQUIRY_COLS = 'id, listing_id, workspace_id, tenant_id, client_phone, client_name, enquiry_type, offer_price_kobo, status, created_at, updated_at';
function rowToEnquiry(r: Record<string, unknown>): PropertyEnquiry {
  return { id: r['id'] as string, listingId: r['listing_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, clientName: r['client_name'] as string, enquiryType: r['enquiry_type'] as PropertyEnquiry['enquiryType'], offerPriceKobo: r['offer_price_kobo'] as number | null, status: r['status'] as EnquiryStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const COMMISSION_COLS = 'id, listing_id, workspace_id, tenant_id, transaction_type, gross_value_kobo, commission_rate_pct, commission_kobo, status, created_at, updated_at';
function rowToCommission(r: Record<string, unknown>): PropertyCommission {
  return { id: r['id'] as string, listingId: r['listing_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, transactionType: r['transaction_type'] as PropertyCommission['transactionType'], grossValueKobo: r['gross_value_kobo'] as number, commissionRatePct: r['commission_rate_pct'] as number, commissionKobo: r['commission_kobo'] as number, status: r['status'] as CommissionStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class RealEstateAgencyRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateRealEstateAgencyInput): Promise<RealEstateAgencyProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO real_estate_agency_profiles (id, workspace_id, tenant_id, agency_name, niesv_number, esvarbon_number, cac_number, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.agencyName, input.niesvNumber ?? null, input.esvarbonNumber ?? null, input.cacNumber ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[real-estate-agency] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<RealEstateAgencyProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM real_estate_agency_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<RealEstateAgencyProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM real_estate_agency_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateRealEstateAgencyInput): Promise<RealEstateAgencyProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.agencyName !== undefined) { sets.push('agency_name = ?'); b.push(input.agencyName); }
    if ('niesvNumber' in input) { sets.push('niesv_number = ?'); b.push(input.niesvNumber ?? null); }
    if ('esvarbonNumber' in input) { sets.push('esvarbon_number = ?'); b.push(input.esvarbonNumber ?? null); }
    if ('cacNumber' in input) { sets.push('cac_number = ?'); b.push(input.cacNumber ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE real_estate_agency_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: RealEstateAgencyFSMState): Promise<RealEstateAgencyProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createListing(input: CreatePropertyListingInput): Promise<PropertyListing> {
    if (!Number.isInteger(input.priceKobo) || input.priceKobo <= 0) throw new Error('[real-estate-agency] priceKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_listings (id, workspace_id, tenant_id, title, type, transaction_type, state, lga, address, price_kobo, bedrooms, bathrooms, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.title, input.type, input.transactionType, input.state ?? null, input.lga ?? null, input.address ?? null, input.priceKobo, input.bedrooms ?? null, input.bathrooms ?? null).run();
    const l = await this.findListingById(id, input.tenantId); if (!l) throw new Error('[real-estate-agency] listing create failed'); return l;
  }

  async findListingById(id: string, tenantId: string): Promise<PropertyListing | null> {
    const row = await this.db.prepare(`SELECT ${LISTING_COLS} FROM property_listings WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToListing(row) : null;
  }

  async listListings(workspaceId: string, tenantId: string): Promise<PropertyListing[]> {
    const { results } = await this.db.prepare(`SELECT ${LISTING_COLS} FROM property_listings WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToListing);
  }

  async updateListingStatus(id: string, tenantId: string, status: ListingStatus): Promise<PropertyListing | null> {
    await this.db.prepare(`UPDATE property_listings SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findListingById(id, tenantId);
  }

  async createEnquiry(input: CreatePropertyEnquiryInput): Promise<PropertyEnquiry> {
    if (input.offerPriceKobo !== undefined && (!Number.isInteger(input.offerPriceKobo) || input.offerPriceKobo < 0)) throw new Error('[real-estate-agency] offerPriceKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_enquiries (id, listing_id, workspace_id, tenant_id, client_phone, client_name, enquiry_type, offer_price_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', unixepoch(), unixepoch())`).bind(id, input.listingId, input.workspaceId, input.tenantId, input.clientPhone, input.clientName, input.enquiryType, input.offerPriceKobo ?? null).run();
    const e = await this.findEnquiryById(id, input.tenantId); if (!e) throw new Error('[real-estate-agency] enquiry create failed'); return e;
  }

  async findEnquiryById(id: string, tenantId: string): Promise<PropertyEnquiry | null> {
    const row = await this.db.prepare(`SELECT ${ENQUIRY_COLS} FROM property_enquiries WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToEnquiry(row) : null;
  }

  async listEnquiries(listingId: string, tenantId: string): Promise<PropertyEnquiry[]> {
    const { results } = await this.db.prepare(`SELECT ${ENQUIRY_COLS} FROM property_enquiries WHERE listing_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(listingId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToEnquiry);
  }

  async updateEnquiryStatus(id: string, tenantId: string, status: EnquiryStatus): Promise<PropertyEnquiry | null> {
    await this.db.prepare(`UPDATE property_enquiries SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findEnquiryById(id, tenantId);
  }

  async createCommission(input: CreatePropertyCommissionInput): Promise<PropertyCommission> {
    if (!Number.isInteger(input.grossValueKobo) || input.grossValueKobo <= 0) throw new Error('[real-estate-agency] grossValueKobo must be positive integer (P9)');
    const commissionKobo = Math.floor((input.grossValueKobo * input.commissionRatePct) / 100);
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_commissions (id, listing_id, workspace_id, tenant_id, transaction_type, gross_value_kobo, commission_rate_pct, commission_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', unixepoch(), unixepoch())`).bind(id, input.listingId, input.workspaceId, input.tenantId, input.transactionType, input.grossValueKobo, input.commissionRatePct, commissionKobo).run();
    const c = await this.findCommissionById(id, input.tenantId); if (!c) throw new Error('[real-estate-agency] commission create failed'); return c;
  }

  async findCommissionById(id: string, tenantId: string): Promise<PropertyCommission | null> {
    const row = await this.db.prepare(`SELECT ${COMMISSION_COLS} FROM property_commissions WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToCommission(row) : null;
  }

  async listCommissions(workspaceId: string, tenantId: string): Promise<PropertyCommission[]> {
    const { results } = await this.db.prepare(`SELECT ${COMMISSION_COLS} FROM property_commissions WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToCommission);
  }

  async updateCommissionStatus(id: string, tenantId: string, status: CommissionStatus): Promise<PropertyCommission | null> {
    await this.db.prepare(`UPDATE property_commissions SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findCommissionById(id, tenantId);
  }
}
