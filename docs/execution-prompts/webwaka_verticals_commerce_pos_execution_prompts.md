# WebWaka OS — Verticals Execution Prompts: Commerce + POS

**Document type:** Agent execution prompt set  
**Scope:** Commerce verticals (45 total) + POS Business Management System  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone:** M8b (POS Business) → M8e (remaining Commerce)  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged

---

### General rules for all agents using these prompts

- **Never make assumptions** about WebWaka's architecture, API contracts, or business logic. Always read the referenced documents and code first.
- **Research deeply** before executing. When encountering domain-specific patterns (POS reconciliation, restaurant inventory, market multi-vendor), do online research first.
- **Thoroughness is far more important than speed.** Spend extra time reading, planning, and validating.
- **All work must be pushed to GitHub.** No local partial work should remain outside the repo.
- **SuperAgent is the AI layer** — all AI features in verticals route through `packages/superagent` (SA Phase 1). Never call AI providers directly from vertical code.
- **Platform Invariants are non-negotiable.** Read `docs/governance/platform-invariants.md` in full before implementing any vertical.
- **The verticals FSM engine** in `packages/verticals/` governs lifecycle states. All verticals must use it — no custom state machines.

---

## TASK V-COMM-1: POS Business Management System Vertical

- **Module / vertical:** `packages/verticals` + vertical slug `pos-business`
- **Priority:** P1-Original — must reach production before M10
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Verticals FSM engine: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/verticals/src/
  - Verticals dependency DAG: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-dependency-dag.md
  - POS package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/pos/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Float ledger migration: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/0024_float_ledger.sql
  - POS terminals migration: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/0023_pos_terminals.sql
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md
  - Entitlement model: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/entitlement-model.md
  - SuperAgent integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - AI capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md
  - Verticals seed: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/migrations/0036_verticals_table.sql

---

You are an expert **Senior Full-Stack Engineer** specializing in POS systems, retail operations software, and multi-tenant SaaS platforms, working on WebWaka OS.

**Skills required:**
- POS hardware and software architecture — agent networks, float management, terminal registration
- Inventory management systems — SKU, stock tracking, reorder alerts
- Nigerian fintech context — CBN agent banking guidelines, POS float reconciliation
- Cloudflare Workers + Hono + D1 TypeScript strict
- WebWaka SuperAgent integration — AI features routing through `packages/superagent`
- Verticals FSM lifecycle states

---

**1. Mandatory context reading (100% before execution):**

Read and fully internalize ALL of the following before writing a single line of code:

- `docs/governance/verticals-master-plan.md` — section on P1-Original verticals; POS Business entry; infrastructure requirements
- `docs/governance/verticals-dependency-dag.md` — POS Business dependencies (CAC, inventory schema, existing `packages/pos`)
- `packages/verticals/src/` — FSM engine, `registerVertical()`, lifecycle states (`seeded` → `active`)
- `packages/pos/` — existing float-ledger, agent terminal, POS infrastructure packages
- `infra/db/migrations/0023_pos_terminals.sql` and `0024_float_ledger.sql` — existing schema to build on
- `docs/governance/ai-integration-framework.md` — how AI features connect to vertical workflows
- `docs/governance/ai-capability-matrix.md` — which AI capabilities are available for Commerce tier
- `docs/governance/superagent/02-product-spec.md` — AI tier requirements (which plan tier for AI features)
- `docs/governance/platform-invariants.md` — P2 (Nigeria First), P9 (integer kobo), T3 (tenant isolation), T4 (kobo-only financial values)
- `docs/governance/entitlement-model.md` — subscription plan requirements for POS features
- `infra/db/migrations/0036_verticals_table.sql` — verticals table and `pos-business` seed entry

---

**2. Online research and execution plan:**

Once context is fully internalized:

- Research:
  - Best practices for POS inventory management (SKU tracking, low-stock alerts, dead-stock identification)
  - Nigerian agent banking architecture — CBN requirements for POS agent float management
  - AI applications in POS/retail: sales forecasting, reorder optimization, fraud flag
  - Multi-vendor POS systems (shared market context for future extension)
- Prepare execution plan:
  - **Objective:** Implement `pos-business` vertical — agent network management, inventory tracking, sales reporting, CRM, and AI-powered stock forecasting via SuperAgent
  - **Key steps** (numbered and ordered)
  - **Risks:** float reconciliation integrity, inventory count sync across agent terminals

---

**3. Implementation workflow:**

Branch: `feat/vertical-pos-business` from `main`.

**3.1 Vertical registration:**
- Register `pos-business` in `packages/verticals/src/registry.ts` with FSM lifecycle: `seeded → onboarding → kyc_pending → active → suspended`
- Vertical config: required KYC tier (CAC registration), required entitlement plan, allowed AI capabilities

**3.2 Schema additions** (new migration after 0036):
```sql
-- pos_business_profiles
CREATE TABLE pos_business_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  business_name TEXT NOT NULL,
  cac_reg_number TEXT,
  cbn_agent_code TEXT,
  terminal_count INTEGER NOT NULL DEFAULT 0,
  active_agents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- pos_inventory_items
CREATE TABLE pos_inventory_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit_price_kobo INTEGER NOT NULL CHECK (unit_price_kobo > 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_threshold INTEGER NOT NULL DEFAULT 10,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_pos_sku ON pos_inventory_items (workspace_id, sku);
```

**3.3 API routes** (`apps/api/src/routes/verticals/pos-business.ts`):
- `GET /v/pos-business/profile` — workspace profile
- `POST /v/pos-business/inventory` — add inventory item (P9: unit_price_kobo integer only)
- `GET /v/pos-business/inventory` — list with low-stock filter
- `POST /v/pos-business/inventory/:id/adjust` — stock adjustment with audit log
- `GET /v/pos-business/sales/summary?period=` — sales summary from float ledger
- `GET /v/pos-business/agents` — list registered agents for this workspace

**3.4 AI features** (route through SuperAgent — SA Phase 1 must be merged first):
- `POST /v/pos-business/ai/reorder-forecast` — sends recent sales data to `resolveAdapter()`, gets reorder recommendations; burns WC credits
- `POST /v/pos-business/ai/sales-summary-draft` — generates plain-English sales report from numeric data

AI routes must: check `requireAiRights` → check `requireNdprConsent('ai_usage')` → call `burnAndRecord()` → call AI → record `ai_usage_events`.

**3.5 Entitlement guards:**
- All POS routes: `requireAuth` + `requireKYCTier('cac_registered')`
- AI routes: additionally `requireAiRights` + plan tier `growth`

---

**4. QA and verification:**

Act as a **Senior QA Engineer** with POS systems and fintech testing experience.

**Test plan — `apps/api/src/routes/verticals/pos-business.test.ts`:**

Positive test cases:
- Inventory item created with correct integer kobo price (P9)
- Stock adjustment logged with before/after quantities
- Sales summary returns correct aggregated kobo values
- Agent list scoped to workspace (T3)

Negative / edge cases:
- Fractional kobo price rejected (T4 — P9)
- Stock adjustment below zero rejected
- Another tenant cannot access this workspace's inventory (T3)
- AI forecast blocked when `aiRights: false`
- AI forecast blocked when NDPR consent absent (P10)
- AI request on USSD session blocked (P12)

Security tests:
- Unauthenticated requests to all routes → 401
- Wrong KYC tier → 403

Minimum: 15 test cases.

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/pos-business): POS Business Management vertical — inventory, agents, AI forecasting (M8b)`
- PR description references: verticals master plan P1-Original section, platform invariants P9/T3/T4, AI integration framework, SuperAgent product spec
- PR checklist:
  - [ ] Vertical registered in FSM
  - [ ] Schema migration created and numbered
  - [ ] All routes protected by correct guards
  - [ ] AI routes use SuperAgent burn engine
  - [ ] Tests ≥ 15, all passing
  - [ ] Zero typecheck errors
  - [ ] Zero lint errors

---

## TASK V-COMM-2: Restaurant and Food Service Vertical

- **Module / vertical:** `packages/verticals` + vertical slug `restaurant`
- **Priority:** P2-Top100 (score ≥ 30/30)
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - Community package (for ordering events): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Payments: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Offerings model: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/offerings/ (if present)
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md

---

You are an expert **Senior Full-Stack Engineer** specializing in restaurant management systems, food-tech SaaS, and African urban food economy, working on WebWaka OS.

**Skills required:**
- Restaurant POS and order management — table/seat tracking, kitchen order queue, menu management
- Delivery and logistics integration patterns
- Nigerian food service context (menu pricing in kobo, multi-branch operations)
- Hono + D1 + TypeScript strict; WebWaka SuperAgent for AI features

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Commerce category; restaurant entry and requirements
- `docs/governance/verticals-dependency-dag.md` — restaurant dependencies
- `packages/verticals/src/` — FSM engine
- `docs/governance/ai-integration-framework.md` — AI in food-service workflows (menu optimization, demand forecasting)
- `docs/governance/ai-capability-matrix.md` — applicable capabilities
- `docs/governance/platform-invariants.md` — P2, P9, T3

---

**2. Online research and execution plan:**

- Research: Nigerian restaurant software landscape (Loystar, Orda, alternatives)
- Research: AI menu optimization, demand forecasting for SME restaurants
- Research: food ordering workflow patterns (WhatsApp catalog, USSD menus — note: AI excluded from USSD P12)
- Execution plan:
  - **Objective:** Register `restaurant` vertical; implement menu management, order tracking, table/takeaway modes, and AI demand forecasting via SuperAgent
  - **Key steps** (numbered)

---

**3. Implementation workflow:**

Branch: `feat/vertical-restaurant` from `main`.

**Vertical registration:** `restaurant` in FSM registry; lifecycle `seeded → onboarding → active`; required plan: Starter+.

**Schema additions:**
- `restaurant_profiles` — name, CAC reg, delivery_enabled, tables_count, kobo-based min_order
- `menu_items` — workspace-scoped, category, price_kobo (integer, P9), available flag, preparation_time_mins
- `orders` — workspace-scoped, customer contact ref, status FSM (`pending → confirmed → preparing → ready → delivered | cancelled`), total_kobo, items JSON, channel (`pos | whatsapp | ussd_excluded`)

**API routes** (`apps/api/src/routes/verticals/restaurant.ts`):
- `GET/POST /v/restaurant/menu` — list/add menu items
- `POST /v/restaurant/orders` — create order
- `PATCH /v/restaurant/orders/:id/status` — update order status
- `GET /v/restaurant/orders?status=&date=` — list orders
- `POST /v/restaurant/ai/demand-forecast` — SuperAgent: weekly demand prediction from order history
- `POST /v/restaurant/ai/menu-description` — SuperAgent: generate menu item descriptions in English + Pidgin

---

**4. QA and verification:**

Minimum 12 test cases:
- Menu item with non-integer kobo price rejected (P9)
- Order total calculation in integer kobo (P9/T4)
- Order status transitions follow FSM (invalid transition → 422)
- Tenant isolation on orders (T3)
- AI demand forecast: blocked without AI rights; blocked without NDPR consent; blocked on USSD channel (P12)
- Unauthenticated access → 401

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/restaurant): Restaurant vertical — menu, orders, AI demand forecasting (M8e)`
- PR checklist: FSM registered ✓ | Schema migration ✓ | AI via SuperAgent ✓ | Tests ≥ 12 ✓

---

## TASK V-COMM-3: Supermarket and Retail Store Vertical

- **Module / vertical:** `packages/verticals` + vertical slug `supermarket`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - (Same core refs as V-COMM-1 for inventory patterns)
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md

---

You are an expert **Senior Full-Stack Engineer** specializing in retail FMCG software and inventory systems, working on WebWaka OS.

**Skills required:**
- Retail inventory management at scale — barcode scanning patterns, batch stock updates
- Supplier management, purchase orders, and GRN (Goods Received Note)
- Price list management, promotions, and discounting (all in integer kobo, P9)
- WebWaka SuperAgent for AI-powered shelf replenishment recommendations

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Commerce / supermarket entry
- `docs/governance/verticals-dependency-dag.md`
- `packages/verticals/src/`
- (All platform invariant refs as V-COMM-1)

---

**2. Online research and execution plan:**

- Research: Nigerian FMCG retail patterns — informal market vs. modern trade; Pricewatch, Carry1st commerce context
- Research: AI-powered shelf replenishment and FMCG demand sensing
- Execution plan:
  - **Objective:** `supermarket` vertical — product catalog, stock management, supplier orders, AI reorder recommendations
  - **Key steps** (numbered)

---

**3. Implementation workflow:**

Branch: `feat/vertical-supermarket` from `main`.

**Schema additions:**
- `retail_products` — sku, barcode, name, category, brand, unit_price_kobo, wholesale_price_kobo, stock_qty, reorder_point
- `retail_suppliers` — workspace-scoped, name, contact, terms
- `purchase_orders` — supplier ref, status, items JSON, total_kobo
- `sales_transactions` — workspace-scoped, items JSON, total_kobo, payment_method, terminal_id

**API routes:**
- CRUD `/v/supermarket/products`
- `POST /v/supermarket/products/batch-import` — CSV-style bulk stock update
- CRUD `/v/supermarket/suppliers`
- `POST/GET /v/supermarket/purchase-orders`
- `POST /v/supermarket/sales` — record sale, auto-decrement stock
- `POST /v/supermarket/ai/reorder-plan` — SuperAgent reorder plan from stock levels and sales velocity

---

**4. QA and verification:**

Minimum 12 test cases:
- Batch import with fractional kobo prices rejected (P9)
- Sale decrements stock correctly
- Reorder alert fires when stock below threshold
- T3 isolation on all product operations
- AI reorder plan blocked without `aiRights`
- Unauthenticated → 401

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/supermarket): Supermarket vertical — product catalog, stock, AI reorder (M8e)`

---

## TASK V-COMM-4: Fashion Brand and Tailoring Vertical

- **Module / vertical:** `packages/verticals` + slug `fashion-brand`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Social package (for lookbook/catalog): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Community package (for customer community): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of fashion e-commerce, bespoke tailoring workflows, and Nigerian fashion industry, working on WebWaka OS.

**Skills required:**
- Fashion catalog management — collections, sizes, variants, measurements
- Bespoke order workflow — measurement records, fitting appointments, production tracking
- Social/community integration for lookbook and customer engagement
- WebWaka SuperAgent for AI-powered product description generation, style recommendations

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Creator / Fashion Brand entry
- `packages/social/` — profile, posts, catalog-style sharing
- `packages/community/` — events (fashion shows), courses (style guides)
- `docs/governance/ai-integration-framework.md` — content generation and recommendation use cases

---

**2. Online research and execution plan:**

- Research: Nigerian fashion market — Atafo, Deola Sagoe, Ejiro Amos Tafiri as reference contexts
- Research: AI in fashion — product description generation, outfit recommendations, trend analysis
- Research: Measurement management for bespoke tailoring (West African standard measurements)
- Execution plan: fashion brand profile, catalog, bespoke orders, AI-generated descriptions

---

**3. Implementation workflow:**

Branch: `feat/vertical-fashion-brand` from `main`.

**Schema additions:**
- `fashion_profiles` — brand_name, style_category, bespoke_enabled, catalog_public
- `fashion_products` — collection, category, gender, sizes_available JSON, price_kobo, images JSON
- `bespoke_orders` — customer_ref, measurements JSON, design_description, status FSM, deposit_kobo, balance_kobo
- `fitting_appointments` — bespoke_order_id, scheduled_at, location, notes

**API routes:**
- CRUD `/v/fashion-brand/products`
- `POST /v/fashion-brand/bespoke-orders` — create with measurements
- `PATCH /v/fashion-brand/bespoke-orders/:id/status` — fitting → production → delivery
- `GET /v/fashion-brand/appointments`
- `POST /v/fashion-brand/ai/product-description` — SuperAgent: generate product descriptions in English + Pidgin
- `POST /v/fashion-brand/ai/style-recommendation` — SuperAgent: outfit pairing from catalog

---

**4. QA and verification:**

Minimum 10 test cases — status FSM transitions, kobo price validation, T3 isolation, AI routes blocked without consent/rights.

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/fashion-brand): Fashion Brand vertical — catalog, bespoke, AI descriptions (M8e)`

---

## TASK V-COMM-5: Wholesale Market and B2B Trade Vertical

- **Module / vertical:** `packages/verticals` + slug `wholesale-market`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Identity package (for CAC/TIN verification): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian wholesale market operations (Alaba, Balogun, Trade Fair), B2B procurement workflows, and commodity pricing, working on WebWaka OS.

**Skills required:**
- B2B wholesale order management — bulk pricing tiers, MOQ (minimum order quantity)
- Nigerian commodity market patterns — currency denomination in kobo (P9), trade credit
- CAC/TIN verification via `packages/identity`
- AI-powered price benchmarking and demand intelligence

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Place / Wholesale Market entry
- `packages/identity/src/` — CAC, TIN, BVN verification patterns
- `packages/payments/` — payment link and webhook patterns
- `docs/governance/platform-invariants.md` — P9, T3, P2

---

**2. Online research and execution plan:**

- Research: Nigerian wholesale market digitization — Alerzo, Omnibiz, TradeDepot as reference
- Research: AI in B2B commerce — price benchmarking, commodity demand forecasting
- Execution plan: vendor profiles, product listings with bulk pricing tiers, purchase orders, AI price benchmarking

---

**3. Implementation workflow:**

Branch: `feat/vertical-wholesale-market` from `main`.

**Schema:**
- `wholesale_vendors` — workspace-scoped, business_name, cac_reg, tin, categories JSON, minimum_order_kobo
- `wholesale_products` — vendor-scoped, name, unit, price_tiers JSON (e.g., `[{min_qty:1, price_kobo:5000}, {min_qty:100, price_kobo:4000}]`), stock_qty
- `wholesale_orders` — buyer_ref, vendor_id, items JSON, total_kobo, status, payment_ref

**API routes:**
- CRUD `/v/wholesale-market/vendors`
- CRUD `/v/wholesale-market/products` with bulk pricing
- `POST /v/wholesale-market/orders`
- `GET /v/wholesale-market/orders?vendor=&status=`
- `POST /v/wholesale-market/ai/price-benchmark` — SuperAgent: compare product price against market data

---

**4. QA and verification:**

Minimum 10 test cases — bulk pricing tier application, MOQ enforcement, kobo validation (P9), T3 isolation, AI benchmark blocked without rights/consent.

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/wholesale-market): Wholesale Market vertical — vendor catalog, bulk orders, AI pricing (M8e)`

---

## TASK V-COMM-AI: AI Feature Integration Across All Commerce Verticals

- **Module:** Cross-cutting AI integration layer for all Commerce verticals
- **GitHub context:**
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - AI context map: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-context-map.md
  - SuperAgent product spec: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/02-product-spec.md
  - Capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md
  - Credit burn engine: `packages/superagent/src/credit-burn.ts` (SA-1.7)

---

You are an expert **Senior Platform AI Integration Engineer**, working on WebWaka OS.

**Skills required:**
- Cross-vertical AI feature design — consistent UX patterns for SuperAgent integration
- Prompt engineering for Nigerian business contexts (English, Pidgin output)
- Credit burn accounting across vertical AI endpoints
- NDPR-compliant AI usage across commerce touchpoints

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/ai-integration-framework.md` — commerce AI use cases (sales analysis, product descriptions, demand forecasting)
- `docs/governance/ai-context-map.md` — AI touchpoints across commerce customer journey
- `docs/governance/superagent/02-product-spec.md` — capability families available for Commerce plans
- `docs/governance/ai-capability-matrix.md` — per-capability cost and tier requirements
- All individual commerce vertical implementations (V-COMM-1 through V-COMM-5)

---

**2. Research and execution plan:**

- Research: GPT-4o prompt patterns for Nigerian SME commerce contexts
- Research: Multilingual output (English + Nigerian Pidgin) for product descriptions
- Execution plan: shared commerce AI utilities module; consistent prompt templates; usage event tagging by vertical slug

---

**3. Implementation workflow:**

Branch: `feat/commerce-ai-integration` from `main`.

Create `packages/superagent/src/prompts/commerce.ts`:
- `buildDemandForecastPrompt(salesData: WeeklySalesData[], vertical: string): string`
- `buildProductDescriptionPrompt(product: ProductData, languages: string[]): string`
- `buildReorderPlanPrompt(inventory: InventoryData[], velocity: VelocityData[]): string`

All prompts must: include Nigeria-context framing; never include raw user identifiers (P13); produce outputs in English + Pidgin where language array includes `pcm`.

Create `packages/superagent/src/commerce-ai.ts`:
- `generateDemandForecast(workspaceId, salesData, env): Promise<DemandForecast>` — calls `burnAndRecord`
- `generateProductDescription(workspaceId, product, languages, env): Promise<string>`
- `generateReorderPlan(workspaceId, inventory, velocity, env): Promise<ReorderPlan>`

---

**4. QA and verification:**

- Prompt builders produce non-empty strings with Nigeria context included
- `burnAndRecord` called exactly once per AI call
- Usage events tagged with correct vertical slug
- PII-free prompt content verified (no raw userId, phone, BVN in prompts)
- Pidgin output triggered when `languages` includes `pcm`
- At least 10 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent/commerce): shared commerce AI prompts and integration utilities`
- PR references: AI integration framework, AI context map, capability matrix

---

*End of Commerce + POS Verticals Execution Prompts.*
*Task blocks: V-COMM-1 (POS Business — P1 Original), V-COMM-2 (Restaurant), V-COMM-3 (Supermarket), V-COMM-4 (Fashion Brand), V-COMM-5 (Wholesale Market), V-COMM-AI (Cross-cutting AI integration).*
*Additional Commerce verticals from the 45-vertical Commerce category should follow the same template, extending from `webwaka_verticals_commerce_pos_execution_prompts.md`.*
