# WebWaka OS — Unimplemented Vertical Tasks

**Generated:** 2026-04-09 (revised after full gap analysis + Set J authored)
**Source of truth:** `infra/db/seeds/0004_verticals-master.csv` — 157 unique slugs (160 rows; 3 exact duplicates)
**Total covered by any prompt:** 157 slugs — **ALL GAPS CLOSED ✅**
**Prompt documented, not yet implemented in code:** 154 task blocks across Sets A–J
**NO PROMPT EXISTS YET:** 0 — all gaps filled by Set J (`webwaka_verticals_set_j_missing_execution_prompts.md`)
**Next available migration number:** `0057`
**Base prompt directory:** `docs/execution-prompts/`

---

## ⚠️ CRITICAL FOR IMPLEMENTING AGENTS — READ BEFORE WRITING ANY MIGRATION

> **Next available migration number: `0057`**  
> Last used: `0056_missing_vertical_tables.sql`  
> Before creating any migration file, run: `ls infra/db/migrations/ | sort | tail -5`  
> Always use the next sequential number. Never skip or reuse numbers.

---

## Pending Issues

| # | Issue | Severity | Status | Location |
|---|-------|----------|--------|----------|
| 1 | `DELETE /politician/:id` had no admin role guard — any authenticated tenant user could hard-delete | **High** | ✅ FIXED (2026-04-09) — role check added at `apps/api/src/routes/politician.ts` L230 | `apps/api/src/routes/politician.ts` |
| 2 | 28 verticals seeded in the CSV had no execution prompt in any document | **High** | ✅ RESOLVED (2026-04-09) — Set J authored, commit `4aff35c` | `docs/execution-prompts/webwaka_verticals_set_j_missing_execution_prompts.md` |
| 3 | PROGRESS.md table showed Sets F–I as `⏳ PENDING`; SHAs and completion log entries missing | Medium | ✅ FIXED (2026-04-09) — all 10 sets show ✅ DONE with SHAs | `docs/execution-prompts/PROGRESS.md` |
| 4 | 2 moderate Dependabot vulnerabilities: `esbuild <=0.24.2` (GHSA-67mh-4wv8-2f99) and `vite` (GHSA-4w7w-66w2-5vf9) | Medium | ✅ PARTIALLY MITIGATED (2026-04-09) — `esbuild` fully fixed via pnpm override `>=0.25.0` (confirmed by audit). `vite` advisory targets vite 6.x; installed version is 5.4.21 (vitest 1.x). pnpm audit reports a false positive because semver `<=6.4.1` technically includes 5.x. Both deps are dev-only (wrangler + vitest). No production exposure. Full fix requires upgrading vitest to 3.x (deferred — scope risk across 50+ packages). | `package.json` → `pnpm.overrides` |
| 5 | `driving-school` slug appears twice in seed CSV with different display names — data quality issue | Low | 🔲 OPEN | `infra/db/seeds/0004_verticals-master.csv` |
| 6 | `nursery-school` and `creche` are two separate slugs; only `creche` has a prompt (Set G) — `nursery-school` covered by Set J | Medium | ✅ RESOLVED by Set J | Set J — `webwaka_verticals_set_j_missing_execution_prompts.md` |
| 7 | `tailor` (P2) and `tailoring-fashion` (P3) are two separate slugs; `tailoring-fashion` in Set B, `tailor` in Set J | Medium | ✅ RESOLVED by Set J | Sets B + J |
| 8 | `gym` (P2, pre-M9) and `gym-fitness` (P3) are two separate slugs; `gym-fitness` had no prompt | Low | ✅ RESOLVED by Set J | Set J — `webwaka_verticals_set_j_missing_execution_prompts.md` |
| 9 | `printing-press` (P3) and `print-shop` (P2) are two separate slugs; `printing-press` had no prompt | Medium | ✅ RESOLVED by Set J | Set J — `webwaka_verticals_set_j_missing_execution_prompts.md` |
| 10 | Next migration number must be checked before any new vertical implementation | Info | 🔲 ONGOING — next is `0057` (see banner above) | `infra/db/migrations/` |

---

## Section 1 — ✅ RESOLVED: Set J Execution Prompts Written (2026-04-09)

All 28 previously missing slugs now have execution prompts in:
**`docs/execution-prompts/webwaka_verticals_set_j_missing_execution_prompts.md`** (commit `4aff35c`)

These prompts are ready for agent implementation. The tables below are preserved for reference.

---

### Originally Missing — Now Covered by Set J

### P2 — High Priority (should be addressed first)

| Slug | Display Name | Category | Notes |
|------|-------------|----------|-------|
| `furniture-maker` | Furniture Maker / Wood Workshop | Commerce | Lagos/Aba furniture industry; SONCAP compliance |
| `gas-distributor` | Gas / LPG Distributor | Commerce | DPR-licensed LPG cylinder distribution; safety-critical |
| `generator-repair` | Generator Repair / HVAC Technician | Commerce | Distinct from generator-dealer (sales); repair/service focus |
| `handyman` | Plumber / Electrician / Handyman | Professional | COREN, SON registration; Nigeria's largest informal trade |
| `hotel` | Hotel / Guesthouse / Shortlet | Hospitality | Lagos shortlet boom; NIHOTOUR, state tourism board |
| `it-support` | IT Support / Computer Repair | Professional | NCC-adjacent; enterprise IT support; Lagos tech corridor |
| `laundry` | Laundry / Dry Cleaner | Commerce | Distinct from `laundry-service`; dry cleaning focus |
| `logistics-delivery` | Logistics & Delivery (Last-Mile) | Transport | Distinct from haulage/courier; GIG, DHL last-mile model |
| `optician` | Optician / Eye Clinic | Health | OONL (Optometrists & Opticians); clinical-adjacent |
| `pharmacy-chain` | Pharmacy Chain / Drugstore | Health | Distinct from single `pharmacy`; PCN multi-branch rules |
| `tailor` | Tailoring / Fashion Designer | Commerce | P2 version distinct from `tailoring-fashion` (P3 atelier) |

### P3 — Specialist Priority

| Slug | Display Name | Category | Notes |
|------|-------------|----------|-------|
| `govt-school` | Government School Management | Education | SUBEB/UBEC compliance; different from private-school |
| `gym-fitness` | Gym / Fitness Centre | Health | P3 distinct from `gym` (P2 wellness); fitness-first brand |
| `internet-cafe` | Internet Café / Business Centre | Commerce | NCC-registered; photocopy + printing + browsing |
| `iron-steel` | Iron & Steel / Roofing Merchant | Commerce | Koko port imports; Nnewi roofing distribution |
| `land-surveyor` | Land Surveyor / Registry Agent | Professional | SURCON licensing; land registry integration; Lagos LASRECAMP |
| `laundry-service` | Laundromat / Laundry Service | Commerce | Distinct from `laundry`; self-service/wash-and-fold model |
| `market-association` | Market Leaders / Traders Association | Civic | Market chairman/leadership body; distinct from `market` |
| `ministry-mission` | Ministry / Apostolic Mission / Outreach | Civic | Pentecostal mission networks; IT registration; P3 civic |
| `motivational-speaker` | Motivational Speaker / Training Firm | Creator/Professional | Speaking engagement booking; corporate training |
| `motorcycle-accessories` | Motorcycle Accessories Shop | Commerce | Ladipo/Nnewi motorcycle parts; massive informal market |
| `nursery-school` | Nursery / Crèche / Early Childhood Centre | Education | P3 distinct from `creche` (P3 daycare); SUBEB oversight |
| `oil-gas-services` | Oil & Gas Service Provider | Commerce | DPR-OML adjacent; service company; NCDMB local content |
| `okada-keke` | Okada / Keke Rider Co-op | Transport | NURTW/OOAN affiliated; state ban compliance |
| `orphanage` | Orphanage / Child Care NGO | Civic/Health | FMWASD regulation; child data = absolute P13 |
| `paints-distributor` | Paints & Coatings Distributor | Commerce | NAFDAC-adjacent; SON certification; Berger/Dulux network |
| `plumbing-supplies` | Plumbing Supplies Dealer | Commerce | SON-certified fittings; Apapa/Oke-Arin market |
| `printing-press` | Printing Press / Design Studio | Commerce | P3 distinct from `print-shop` (P2); large-format/offset |

---

## Section 2 — Documented in Sets A–I (126 task blocks, not yet implemented in code)

The following 126 verticals have execution prompts written and are ready for agent implementation.

---

### Set A — Commerce P2 Batch 1 (9 verticals)

**Milestone:** M10–M11
**File:** [`webwaka_verticals_commerce_p2_batch1_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-COMM-EXT-A1 | `auto-mechanic` | Auto Mechanic / Garage | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a1-auto-mechanic--garage-vertical) |
| V-COMM-EXT-A2 | `bakery` | Bakery / Confectionery | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a2-bakery--confectionery-vertical) |
| V-COMM-EXT-A3 | `beauty-salon` | Beauty Salon / Barber Shop | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a3-beauty-salon--barber-shop-vertical) |
| V-COMM-EXT-A4 | `bookshop` | Bookshop / Stationery Store | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a4-bookshop--stationery-store-vertical) |
| V-COMM-EXT-A5 | `catering` | Catering Service | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a5-catering-service-vertical) |
| V-COMM-EXT-A6 | `cleaning-service` | Cleaning Service | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a6-cleaning-service-vertical) |
| V-COMM-EXT-A7 | `electronics-repair` | Electronics Repair Shop | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a7-electronics-repair-shop-vertical) |
| V-COMM-EXT-A8 | `florist` | Florist / Garden Centre | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a8-florist--garden-centre-vertical) |
| V-COMM-EXT-A9 | `food-vendor` | Food Vendor / Street Food | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch1_execution_prompts.md#task-v-comm-ext-a9-food-vendor--street-food-vertical) |

---

### Set B — Commerce P2 Batch 2 (12 verticals)

**Milestone:** M11
**File:** [`webwaka_verticals_commerce_p2_batch2_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-COMM-EXT-B1 | `construction` | Construction Firm / Contractor | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b1-construction-firm--contractor-vertical) |
| V-COMM-EXT-B2 | `fuel-station` | Fuel / Filling Station | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b2-fuel--filling-station-vertical) |
| V-COMM-EXT-B3 | `print-shop` | Printing & Branding Shop | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b3-printing--branding-shop-vertical) |
| V-COMM-EXT-B4 | `property-developer` | Property Developer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b4-property-developer-vertical) |
| V-COMM-EXT-B5 | `real-estate-agency` | Real Estate Agency | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b5-real-estate-agency-vertical) |
| V-COMM-EXT-B6 | `restaurant-chain` | Restaurant / Food Chain Outlet | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b6-restaurant--food-chain-outlet-vertical) |
| V-COMM-EXT-B7 | `security-company` | Security Company / Guard Service | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b7-security-company--guard-service-vertical) |
| V-COMM-EXT-B8 | `solar-installer` | Solar / Renewable Energy Installer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b8-solar--renewable-energy-installer-vertical) |
| V-COMM-EXT-B9 | `spa` | Spa / Massage Parlour | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b9-spa--massage-parlour-vertical) |
| V-COMM-EXT-B10 | `tailoring-fashion` | Tailoring / Fashion Designer (atelier) | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b10-tailoring--fashion-designer-vertical) |
| V-COMM-EXT-B11 | `travel-agent` | Travel Agent / Tour Operator | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b11-travel-agent--tour-operator-vertical) |
| V-COMM-EXT-B12 | `welding-fabrication` | Welding / Fabrication Shop | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p2_batch2_execution_prompts.md#task-v-comm-ext-b12-welding--fabrication-shop-vertical) |

---

### Set C — Commerce P3 Tail (15 verticals)

**Milestone:** M11–M12
**File:** [`webwaka_verticals_commerce_p3_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-COMM-EXT-C1 | `artisanal-mining` | Artisanal Mining Operator | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c1-artisanal-mining-operator-vertical) |
| V-COMM-EXT-C2 | `borehole-driller` | Borehole Drilling Company | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c2-borehole-drilling-company-vertical) |
| V-COMM-EXT-C3 | `building-materials` | Building Materials Supplier | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c3-building-materials-supplier-vertical) |
| V-COMM-EXT-C4 | `car-wash` | Car Wash / Detailing | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c4-car-wash--detailing-vertical) |
| V-COMM-EXT-C5 | `cleaning-company` | Cleaning & Facility Management Co. | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c5-cleaning--facility-management-company-vertical) |
| V-COMM-EXT-C6 | `electrical-fittings` | Electrical Fittings Dealer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c6-electrical-fittings-dealer-vertical) |
| V-COMM-EXT-C7 | `generator-dealer` | Generator Sales & Service Centre | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c7-generator-sales--service-centre-vertical) |
| V-COMM-EXT-C8 | `hair-salon` | Hair Salon / Barbing Salon | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c8-hair-salon--barbing-salon-vertical) |
| V-COMM-EXT-C9 | `petrol-station` | Petrol Station (DPR/NUPRC-licensed) | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c9-petrol-station-dprnuprc-licensed-vertical) |
| V-COMM-EXT-C10 | `phone-repair-shop` | Phone Repair & Accessories Shop | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c10-phone-repair--accessories-shop-vertical) |
| V-COMM-EXT-C11 | `shoemaker` | Shoe Cobbler / Shoe Maker | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c11-shoe-cobbler--shoe-maker-vertical) |
| V-COMM-EXT-C12 | `spare-parts` | Spare Parts Dealer (Ladipo/Nnewi) | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c12-spare-parts-dealer-ladipoNnewi-vertical) |
| V-COMM-EXT-C13 | `tyre-shop` | Tyre Shop / Vulcanizer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c13-tyre-shop--vulcanizer-vertical) |
| V-COMM-EXT-C14 | `used-car-dealer` | Used Car Dealer / Auto Trader | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c14-used-car-dealer--auto-trader-vertical) |
| V-COMM-EXT-C15 | `water-vendor` | Water Tanker / Sachet Water Producer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_commerce_p3_execution_prompts.md#task-v-comm-ext-c15-water-tanker--sachet-water-producer-vertical) |

---

### Set D — Transport Extended (8 verticals)

**Milestone:** M10–M11
**File:** [`webwaka_verticals_transport_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-TRN-EXT-1 | `clearing-agent` | Clearing & Forwarding Agent | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-1-clearing--forwarding-agent-vertical) |
| V-TRN-EXT-2 | `courier` | Courier Service | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-2-courier-service-vertical) |
| V-TRN-EXT-3 | `dispatch-rider` | Dispatch Rider Network | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-3-dispatch-rider-network-vertical) |
| V-TRN-EXT-4 | `airport-shuttle` | Airport Shuttle Service | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-4-airport-shuttle-service-vertical) |
| V-TRN-EXT-5 | `cargo-truck` | Cargo Truck Owner / Fleet Operator | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-5-cargo-truck-owner--fleet-operator-vertical) |
| V-TRN-EXT-6 | `container-depot` | Container Depot / Logistics Hub | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-6-container-depot--logistics-hub-vertical) |
| V-TRN-EXT-7 | `ferry` | Ferry / Water Transport Operator | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-7-ferry--water-transport-operator-vertical) |
| V-TRN-EXT-8 | `road-transport-union` | Road Transport Workers Union (NURTW) | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_transport_extended_execution_prompts.md#task-v-trn-ext-8-road-transport-workers-union-nurtw-vertical) |

---

### Set E — Civic Extended (10 verticals)

**Milestone:** M10–M12
**File:** [`webwaka_verticals_civic_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-CIV-EXT-1 | `mosque` | Mosque / Islamic Centre | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-1-mosque--islamic-centre-vertical) |
| V-CIV-EXT-2 | `youth-organization` | Youth Organization / Student Union | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-2-youth-organization--student-union-vertical) |
| V-CIV-EXT-3 | `womens-association` | Women's Association / Forum | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-3-womens-association--forum-vertical) |
| V-CIV-EXT-4 | `waste-management` | Waste Management / Recycler | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-4-waste-management--recycler-vertical) |
| V-CIV-EXT-5 | `book-club` | Book Club / Reading Circle | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-5-book-club--reading-circle-vertical) |
| V-CIV-EXT-6 | `professional-association` | Professional Association (NBA/NMA/ICAN) | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-6-professional-association-nbanmaican-vertical) |
| V-CIV-EXT-7 | `sports-club` | Sports Club / Amateur League | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-7-sports-club--amateur-league-vertical) |
| V-CIV-EXT-8 | `campaign-office` | Campaign Office | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-8-campaign-office-vertical) |
| V-CIV-EXT-9 | `constituency-office` | Constituency Development Office | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-9-constituency-development-office-vertical) |
| V-CIV-EXT-10 | `polling-unit-rep` | Ward Representative / Polling Unit | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_civic_extended_execution_prompts.md#task-v-civ-ext-10-ward-representative--polling-unit-vertical) |

---

### Set F — Health Extended (6 verticals)

**Milestone:** M10–M12
**File:** [`webwaka_verticals_health_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-HLT-EXT-1 | `dental-clinic` | Dental Clinic / Orthodontist | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md#task-v-hlt-ext-1-dental-clinic--orthodontist-vertical) |
| V-HLT-EXT-2 | `sports-academy` | Sports Academy / Fitness Centre | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md#task-v-hlt-ext-2-sports-academy--fitness-centre-vertical) |
| V-HLT-EXT-3 | `vet-clinic` | Veterinary Clinic / Pet Shop | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md#task-v-hlt-ext-3-veterinary-clinic--pet-shop-vertical) |
| V-HLT-EXT-4 | `community-health` | Community Health Worker (CHW) Network | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md#task-v-hlt-ext-4-community-health-worker-chw-network-vertical) |
| V-HLT-EXT-5 | `elderly-care` | Elderly Care Facility | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md#task-v-hlt-ext-5-elderly-care-facility-vertical) |
| V-HLT-EXT-6 | `rehab-centre` | Rehabilitation / Recovery Centre | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_health_extended_execution_prompts.md#task-v-hlt-ext-6-rehabilitation--recovery-centre-vertical) |

---

### Set G — Education + Agricultural Extended (13 verticals)

**Milestone:** M10–M12
**File:** [`webwaka_verticals_education_agricultural_extended_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-EDU-EXT-1 | `driving-school` | Driving School (FRSC-Licensed) | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-edu-ext-1-driving-school-frsc-licensed-vertical) |
| V-EDU-EXT-2 | `training-institute` | Training Institute / Vocational School | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-edu-ext-2-training-institute--vocational-school-vertical) |
| V-EDU-EXT-3 | `creche` | Crèche / Day Care Centre | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-edu-ext-3-crèche--day-care-centre-vertical) |
| V-EDU-EXT-4 | `private-school` | Private School Operator | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-edu-ext-4-private-school-operator-vertical) |
| V-AGR-EXT-1 | `agro-input` | Agro-Input Dealer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-1-agro-input-dealer-vertical) |
| V-AGR-EXT-2 | `cold-room` | Cold Room / Storage Facility | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-2-cold-room--storage-facility-vertical) |
| V-AGR-EXT-3 | `abattoir` | Abattoir / Meat Processing | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-3-abattoir--meat-processing-vertical) |
| V-AGR-EXT-4 | `cassava-miller` | Cassava / Maize / Rice Miller | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-4-cassava--maize--rice-miller-vertical) |
| V-AGR-EXT-5 | `cocoa-exporter` | Cocoa / Export Commodities Trader | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-5-cocoa--export-commodities-trader-vertical) |
| V-AGR-EXT-6 | `fish-market` | Fish Market / Fishmonger | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-6-fish-market--fishmonger-vertical) |
| V-AGR-EXT-7 | `food-processing` | Food Processing Factory | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-7-food-processing-factory-vertical) |
| V-AGR-EXT-8 | `palm-oil-trader` | Palm Oil / Vegetable Oil Producer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-8-palm-oil--vegetable-oil-producer-vertical) |
| V-AGR-EXT-9 | `vegetable-garden` | Vegetable Garden / Horticulture | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_education_agricultural_extended_execution_prompts.md#task-v-agr-ext-9-vegetable-garden--horticulture-vertical) |

---

### Set H — Professional + Creator Extended (11 verticals)

**Milestone:** M10–M12
**File:** [`webwaka_verticals_professional_creator_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-PRO-EXT-1 | `accounting-firm` | Accounting Firm / Audit Practice | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-1-accounting-firm--audit-practice-vertical) |
| V-PRO-EXT-2 | `event-planner` | Event Planner / MC | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-2-event-planner--mc-vertical) |
| V-PRO-EXT-3 | `law-firm` | Law Firm / Legal Practice | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-3-law-firm--legal-practice-vertical) |
| V-PRO-EXT-4 | `funeral-home` | Burial / Funeral Home | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-4-burial--funeral-home-vertical) |
| V-PRO-EXT-5 | `pr-firm` | Public Relations Firm | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-5-public-relations-firm-vertical) |
| V-PRO-EXT-6 | `tax-consultant` | Tax Consultant / Revenue Agent | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-6-tax-consultant--revenue-agent-vertical) |
| V-PRO-EXT-7 | `wedding-planner` | Wedding Planner / Celebrant | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-pro-ext-7-wedding-planner--celebrant-vertical) |
| V-CRT-EXT-1 | `music-studio` | Music Studio / Recording Studio | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-crt-ext-1-music-studio--recording-studio-vertical) |
| V-CRT-EXT-2 | `photography` | Photography Studio / Videography | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-crt-ext-2-photography-studio--videography-vertical) |
| V-CRT-EXT-3 | `recording-label` | Record Label / Music Publisher | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-crt-ext-3-record-label--music-publisher-vertical) |
| V-CRT-EXT-4 | `talent-agency` | Talent Agency / Model Agency | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_professional_creator_execution_prompts.md#task-v-crt-ext-4-talent-agency--model-agency-vertical) |

---

### Set I — Financial + Place + Media + Institutional (13 verticals)

**Milestone:** M12
**File:** [`webwaka_verticals_financial_place_media_institutional_execution_prompts.md`](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md)

| Task ID | Slug | Vertical | Prompt Link |
|---------|------|----------|-------------|
| V-FIN-EXT-1 | `airtime-reseller` | Airtime / VTU Reseller | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-fin-ext-1-airtime--vtu-reseller-vertical) |
| V-FIN-EXT-2 | `bureau-de-change` | Bureau de Change / FX Dealer | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-fin-ext-2-bureau-de-change--fx-dealer-vertical) |
| V-FIN-EXT-3 | `hire-purchase` | Hire Purchase / Asset Finance | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-fin-ext-3-hire-purchase--asset-finance-vertical) |
| V-FIN-EXT-4 | `mobile-money-agent` | Mobile Money Agent | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-fin-ext-4-mobile-money-agent-vertical) |
| V-PLC-EXT-1 | `event-hall` | Event Hall / Venue | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-plc-ext-1-event-hall--venue-vertical) |
| V-PLC-EXT-2 | `water-treatment` | Water Treatment / Borehole Operator | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-plc-ext-2-water-treatment--borehole-operator-vertical) |
| V-PLC-EXT-3 | `community-hall` | Community Hall / Town Hall | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-plc-ext-3-community-hall--town-hall-vertical) |
| V-PLC-EXT-4 | `events-centre` | Events Centre / Hall Rental | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-plc-ext-4-events-centre--hall-rental-vertical) |
| V-MED-EXT-1 | `advertising-agency` | Advertising Agency | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-med-ext-1-advertising-agency-vertical) |
| V-MED-EXT-2 | `newspaper-distribution` | Newspaper Distribution / Media House | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-med-ext-2-newspaper-distribution--media-house-vertical) |
| V-MED-EXT-3 | `podcast-studio` | Podcast Studio / Digital Media | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-med-ext-3-podcast-studio--digital-media-vertical) |
| V-INST-EXT-1 | `government-agency` | Government Agency / MDA | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-inst-ext-1-government-agency--mda-vertical) |
| V-INST-EXT-2 | `polling-unit-rep` | Polling Unit / Electoral District | [Link](https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/execution-prompts/webwaka_verticals_financial_place_media_institutional_execution_prompts.md#task-v-inst-ext-2-polling-unit--electoral-district-vertical) |

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| ✅ Set J prompts authored (Section 1) | **28** | Ready for agent execution — commit `4aff35c` |
| Prompt written, code not implemented (Section 2 — Sets A–I) | **126** | Ready for agent execution |
| Already implemented (pre-M9, P1 originals + samples) | **34** | Done |
| CSV duplicate rows (same slug, counted once) | 3 | `driving-school`, `fashion-brand`, `supermarket` |
| **Total unique slugs in seed** | **157** | **All 157 now have execution prompts** |

> **All gaps resolved.** Every unique vertical slug in `0004_verticals-master.csv` now has a full execution prompt. The 154 unimplemented task blocks (Sets A–J) are ready for agent assignment.
