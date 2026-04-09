/**
 * @webwaka/verticals-pos-business
 * POS Business Management vertical — M8b P1-Original.
 *
 * DISTINCT from @webwaka/pos (agent float + terminal heartbeat).
 * This package = SME business management: inventory, sales, CRM.
 *
 * Exports:
 *   InventoryRepository — Product catalog + stock management (T3 isolated)
 *   SalesRepository     — Sale recording + daily reconciliation (T3 isolated)
 *   CustomerRepository  — CRM + loyalty points (T3 isolated)
 *   Types               — PosProduct, PosSale, PosCustomer, SaleItem, etc.
 */

export { InventoryRepository } from './inventory.js';
export { SalesRepository } from './sales.js';
export { CustomerRepository } from './customers.js';

export type {
  PosProduct,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustment,
  PosSale,
  SaleItem,
  PaymentMethod,
  CreateSaleInput,
  PosCustomer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from './types.js';
