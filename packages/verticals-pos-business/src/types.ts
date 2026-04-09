/**
 * packages/verticals-pos-business — Domain types
 * (M8b — Platform Invariants T3, P9)
 *
 * DISTINCT from packages/pos (agent float infrastructure + terminal heartbeat).
 * This package = SME business management: inventory, sales, CRM.
 *
 * P9: All monetary amounts in kobo (integer). All loyalty points are integers.
 * T3: All entities carry tenantId for row-level isolation.
 */

// ---------------------------------------------------------------------------
// Products / Inventory
// ---------------------------------------------------------------------------

export interface PosProduct {
  id: string;
  workspaceId: string;
  tenantId: string;       // T3
  name: string;
  sku: string | null;
  priceKobo: number;      // P9
  stockQty: number;
  category: string | null;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProductInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  name: string;
  sku?: string;
  priceKobo: number;
  stockQty?: number;
  category?: string;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string | null;
  priceKobo?: number;
  stockQty?: number;
  category?: string | null;
  active?: boolean;
}

export interface StockAdjustment {
  delta: number;            // positive = restock, negative = manual write-off
  reason: string;
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export interface SaleItem {
  productId: string;
  qty: number;
  priceKobo: number;        // P9 — price at time of sale (snapshot)
}

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface PosSale {
  id: string;
  workspaceId: string;
  tenantId: string;         // T3
  cashierId: string;
  totalKobo: number;        // P9
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  createdAt: number;
}

export interface CreateSaleInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  cashierId: string;
  paymentMethod: PaymentMethod;
  items: SaleItem[];
}

// ---------------------------------------------------------------------------
// Customers (CRM)
// ---------------------------------------------------------------------------

export interface PosCustomer {
  id: string;
  workspaceId: string;
  tenantId: string;         // T3
  phone: string | null;
  name: string | null;
  loyaltyPts: number;       // P9 — integer points
  createdAt: number;
  updatedAt: number;
}

export interface CreateCustomerInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  phone?: string;
  name?: string;
}

export interface UpdateCustomerInput {
  phone?: string | null;
  name?: string | null;
}
