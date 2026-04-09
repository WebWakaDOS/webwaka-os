# WebWaka OS — Verticals Execution Prompts: Creator + Professional + Financial + Media + Social

**Document type:** Agent execution prompt set  
**Scope:** Creator (8) + Professional (10) + Financial (5) + Media (4) + Social (3) verticals  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone:** M8e  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged

---

### General rules for all agents using these prompts

- **Never make assumptions** about Nigerian creator economy, professional licensing, or financial regulations. Always read the referenced documents and code first.
- **Financial verticals carry CBN and SEC regulatory constraints.** Consult `docs/governance/ai-billing-and-entitlements.md` and `docs/governance/security-baseline.md` before implementing any financial vertical.
- **Professional verticals require license body verification** (MDCN, NBA, COREN, ICAN, etc.) — use `packages/identity/` patterns.
- **Creator and Social verticals** are heavy users of `packages/social` — read it thoroughly.
- **All AI routes through SuperAgent** — never call providers directly. Media/creator verticals may use multimodal capabilities — check tier requirements in capability matrix first.
- **All financial values in kobo** (P9, T4) — professional fees, savings, premiums, commissions.

---

## TASK V-CRT-1: Creator / Influencer Vertical

- **Module / vertical:** `packages/verticals` + slug `creator`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - AI capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian creator economy (Instagram, TikTok, YouTube, Twitter creators), influencer marketing, and digital content monetization, working on WebWaka OS.

**Skills required:**
- Creator portfolio and media management — content catalog, engagement metrics
- Brand deal / sponsorship management — rate cards, contracts, campaign tracking (kobo P9)
- Social integration — `packages/social` profiles, posts, groups
- Community integration — exclusive member communities for fans
- AI-powered content calendar, caption generation, and audience analytics

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Creator / Influencer entry (P1-Original, M8e); social, community, payments dependencies
- `packages/social/` — profiles, posts, groups, DMs — read all source files
- `packages/community/` — exclusive channels/courses for fan communities
- `packages/payments/` — brand deal payment collection
- `docs/governance/ai-integration-framework.md` — creator AI use cases (content generation, audience insights)
- `docs/governance/ai-capability-matrix.md` — multimodal capabilities for creators (Pro tier required for image gen)
- `docs/governance/platform-invariants.md` — P2, P9, P10, P13, T3

---

**2. Online research and execution plan:**

- Research:
  - Nigerian creator economy — Naira monetization via Paystack, Flutterwave; Afrobeats/Nollywood creator patterns
  - Influencer marketing rate benchmarks (Nigeria) — micro 10K-100K followers, macro 100K+
  - AI in content creation — caption generation, hashtag optimization, content calendar planning
  - Pidgin-English content generation for Nigerian audiences
- Execution plan:
  - **Objective:** Register `creator` vertical; implement portfolio/content catalog, brand deal management, fan community integration, earnings tracker, and AI content calendar + caption generation
  - **Key steps** (numbered)

---

**3. Implementation workflow:**

Branch: `feat/vertical-creator` from `main`.

**Schema:**
```sql
CREATE TABLE creator_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  creator_name TEXT NOT NULL,
  niche TEXT NOT NULL,
  platform_handles JSON NOT NULL DEFAULT '{}',
  follower_count INTEGER NOT NULL DEFAULT 0,
  base_rate_kobo INTEGER NOT NULL DEFAULT 0 CHECK (base_rate_kobo >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE brand_deals (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
  brand_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  deliverables JSON NOT NULL,
  agreed_fee_kobo INTEGER NOT NULL CHECK (agreed_fee_kobo > 0),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'negotiating', 'active', 'completed', 'cancelled')),
  start_date INTEGER,
  end_date INTEGER,
  payment_received_kobo INTEGER NOT NULL DEFAULT 0 CHECK (payment_received_kobo >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE content_pieces (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('reel|post|story|thread|podcast|video')),
  publish_date INTEGER,
  deal_id TEXT REFERENCES brand_deals(id),
  engagement_data JSON,
  created_at INTEGER NOT NULL
);

CREATE TABLE creator_earnings (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
  source TEXT NOT NULL CHECK (source IN ('brand_deal', 'community_membership', 'digital_product', 'gift', 'other')),
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
  payment_ref TEXT,
  earned_at INTEGER NOT NULL
);
```

**API routes** (`apps/api/src/routes/verticals/creator.ts`):
- `GET/PATCH /v/creator/profile`
- `GET/POST /v/creator/deals` — brand deal management
- `PATCH /v/creator/deals/:id/status`
- `GET/POST /v/creator/content` — content catalog
- `POST /v/creator/earnings` — record earnings in kobo
- `GET /v/creator/earnings/summary?period=` — earnings summary in kobo
- `POST /v/creator/ai/content-calendar` — SuperAgent: generate 2-week content calendar for niche + platforms
- `POST /v/creator/ai/caption` — SuperAgent: generate social caption in English + Pidgin for content type
- `POST /v/creator/ai/audience-insights` — SuperAgent: analyze engagement data and surface recommendations

---

**4. QA and verification:**

Minimum 14 test cases:
- Deal fee in integer kobo (P9)
- Payment received cannot exceed agreed fee (guard)
- Earnings summary aggregates in kobo
- Content calendar: blocked without `aiRights`; blocked without NDPR consent (P10)
- Caption includes Pidgin when requested
- T3 isolation on deals and earnings
- Unauthenticated → 401

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/creator): Creator vertical — portfolio, brand deals, earnings, AI content calendar (M8e)`

---

## TASK V-CRT-2: Sole Trader / Artisan Vertical

- **Module / vertical:** `packages/verticals` + slug `sole-trader`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Contact package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/contact/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian artisan and micro-business operations (tailors, carpenters, electricians, plumbers, caterers), WhatsApp catalog patterns, and informal economy digitization, working on WebWaka OS.

**Skills required:**
- Service catalog management — offerings, pricing (kobo P9), availability
- WhatsApp catalog integration pattern (via contact service)
- Simple invoicing for artisans — quote → invoice → payment (kobo)
- AI-powered service description and quote generation

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Creator / Sole Trader entry (P1-Original, M8e); WhatsApp catalog dependency
- `packages/social/` — public profile for artisan discovery
- `packages/contact/` — WhatsApp channel for catalog sharing and customer contact
- `packages/payments/` — invoice payment collection

---

**2. Online research and execution plan:**

- Research: Nigerian artisan economy — Workman, Fixit app patterns; WhatsApp as the primary B2C channel
- Research: AI for micro-business — auto-generated service descriptions, quote drafting
- Execution plan: sole trader profile, service catalog, quote/invoice management, AI service descriptions

---

**3. Implementation workflow:**

Branch: `feat/vertical-sole-trader` from `main`.

**Schema:**
- `sole_trader_profiles` — trade (`tailoring|carpentry|plumbing|electrical|catering|etc`), skill_level, service_area_lga, accepts_whatsapp INTEGER
- `sole_trader_services` — name, description, unit_price_kobo (P9), duration_estimate, availability
- `customer_quotes` — customer_contact_ref, services_requested JSON, quoted_amount_kobo, status (`draft|sent|accepted|rejected`), valid_until
- `invoices` — quote_id, amount_kobo, payment_ref, paid_at

**API routes:**
- `GET/PATCH /v/sole-trader/profile`
- CRUD `/v/sole-trader/services`
- `POST/GET /v/sole-trader/quotes`
- `PATCH /v/sole-trader/quotes/:id/accept`
- `POST /v/sole-trader/invoices/:id/pay`
- `POST /v/sole-trader/ai/service-description` — SuperAgent: generate service description in English + Pidgin from trade + skills
- `POST /v/sole-trader/ai/quote-draft` — SuperAgent: generate quote estimate from requested services

---

**4. QA and verification:**

Minimum 10 test cases — prices in kobo (P9), quote amount in kobo, invoice tied to accepted quote only, T3 isolation, AI description blocked without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/sole-trader): Sole Trader vertical — services, quotes, invoices, AI descriptions (M8e)`

---

## TASK V-PRO-1: Professional Vertical (Lawyer, Doctor, Consultant, Surveyor)

- **Module / vertical:** `packages/verticals` + slug `professional`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Identity package (license bodies): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - AI agent autonomy: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-agent-autonomy.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian professional services (NBA, MDCN, COREN, ICAN, NIESV registration bodies), client management, and professional billing, working on WebWaka OS.

**Skills required:**
- Professional profile management — license body verification, specialty, years of experience
- Client/case management — matter tracking, appointment scheduling
- Professional billing — retainer, hourly, fixed-fee (all in kobo P9)
- AI-powered document drafting (HITL for legal/medical documents — L3 autonomy)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Professional entry (P1-Original, M8e); license bodies, social dependencies
- `packages/identity/` — NBA/MDCN/COREN/ICAN verification patterns
- `docs/governance/ai-agent-autonomy.md` — L3 HITL for legal and medical professional AI content
- `docs/governance/platform-invariants.md` — P13 (client data protection), T3

---

**2. Online research and execution plan:**

- Research: Nigerian professional licensing bodies and their verification APIs (if any)
- Research: Legal practice management software patterns (Clio alternatives for Nigeria)
- Research: AI in professional services — document drafting (HITL mandatory), research summarization
- Execution plan: professional profile (license-verified), client/matter management, appointment booking, billing, AI document drafting (HITL)

---

**3. Implementation workflow:**

Branch: `feat/vertical-professional` from `main`.

**Schema:**
- `professional_profiles` — profession (`lawyer|doctor|engineer|accountant|surveyor|etc`), license_body, license_number, license_verified, specialty, rate_per_hour_kobo
- `clients` — workspace-scoped, client_ref, matter_type, status, created_at
- `matters` — client_id, title, description, billing_mode (`hourly|retainer|fixed`), total_billed_kobo, status
- `time_entries` — matter_id, duration_mins, description, billed_kobo, recorded_at
- `professional_appointments` — matter_id, scheduled_at, type, status
- `document_drafts` — matter_id, doc_type, ai_draft_content, reviewed INTEGER DEFAULT 0, final_content, created_at

**API routes:**
- `GET/PATCH /v/professional/profile`
- CRUD `/v/professional/clients`
- CRUD `/v/professional/matters`
- `POST /v/professional/time-entries`
- `GET /v/professional/billing-summary?matter=`
- `GET/POST /v/professional/appointments`
- `POST /v/professional/ai/document-draft` — HITL: SuperAgent drafts document from matter context → stored as `reviewed: 0`; professional explicitly approves before it becomes `final_content`

---

**4. QA and verification:**

Minimum 14 test cases:
- Billing in integer kobo (P9)
- Time entry billed_kobo calculation correct
- AI document draft stored as `reviewed: 0` (HITL — never auto-finalized)
- Client data T3-isolated (P13)
- License verification required for `active` status
- AI blocked without consent (P10); on USSD (P12)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/professional): Professional vertical — clients, matters, billing, HITL AI document drafting (M8e)`

---

## TASK V-FIN-1: Savings Group / Esusu / Ajo Vertical

- **Module / vertical:** `packages/verticals` + slug `savings-group`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian informal savings culture (Ajo, Esusu, Adashi, thrift), rotating savings mechanisms, and fintech regulation (CBN guidelines for informal savings groups), working on WebWaka OS.

**Skills required:**
- Rotating savings (ROSCA) cycle management — contribution schedule, payout rotation
- Contribution tracking in kobo (P9, T4) — no fractional amounts
- Member trust and transparency — public contribution ledger within group (T3 within group scope)
- AI-powered savings insights and default risk alerts

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Financial / Savings Group entry
- `packages/payments/` — contribution collection via Paystack
- `docs/governance/platform-invariants.md` — P9 (kobo), T3, T4 (all amounts integer kobo)
- `docs/governance/ai-billing-and-entitlements.md` — financial vertical AI constraints

---

**2. Online research and execution plan:**

- Research: Nigerian ROSCA (rotating savings) structure — weekly, monthly cycles; payout rotation mechanisms
- Research: CBN regulations on digital savings groups (informal finance)
- Research: AI in savings groups — default risk scoring, optimal contribution scheduling
- Execution plan: group profile, member roster, contribution cycles, payout rotation, AI default risk alert

---

**3. Implementation workflow:**

Branch: `feat/vertical-savings-group` from `main`.

**Schema:**
- `savings_groups` — workspace-scoped, group_name, cycle_type (`weekly|fortnightly|monthly`), contribution_kobo (P9), member_count, current_cycle, status
- `group_members` — group_id, member_ref, rotation_position, total_contributed_kobo, has_received_payout INTEGER
- `contributions` — group_id, member_id, cycle_number, amount_kobo (P9), payment_ref, recorded_at
- `payouts` — group_id, member_id, cycle_number, amount_kobo (P9), paid_at, method

**API routes:**
- `GET/PATCH /v/savings-group/profile`
- `GET/POST /v/savings-group/members`
- `POST /v/savings-group/contributions` — record contribution (kobo)
- `POST /v/savings-group/payouts` — record payout to rotation position
- `GET /v/savings-group/ledger` — full contribution and payout ledger
- `POST /v/savings-group/ai/risk-alert` — SuperAgent: flag members at risk of default from contribution history

---

**4. QA and verification:**

Minimum 12 test cases:
- Contributions in integer kobo (P9, T4)
- Payout amount equals group size × contribution per cycle (integer kobo)
- Payout can only go to correct rotation position member
- Ledger shows all members' contributions (within group T3 scope)
- AI risk alert uses no raw member names (P13)
- AI blocked without consent (P10)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/savings-group): Savings Group (Ajo/Esusu) vertical — contributions, rotation, AI risk alerts (M8e)`

---

## TASK V-FIN-2: Insurance Agent Vertical

- **Module / vertical:** `packages/verticals` + slug `insurance-agent`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Identity package (NAICOM license): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian insurance market (NAICOM regulation, AIICO, Leadway, Cornerstone agent networks) and insurance agency management, working on WebWaka OS.

**Skills required:**
- Policy portfolio management — life, motor, health, property policies
- Premium collection in kobo (P9) and renewal tracking
- NAICOM license verification
- AI-powered policy recommendation and renewal reminder drafting

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Financial / Insurance Agent entry
- `packages/identity/` — NAICOM license verification
- `docs/governance/platform-invariants.md` — P9 (premium amounts in kobo), T3, P13 (client insurance data sensitivity)

---

**2. Research and execution plan:**

- Research: NAICOM agent licensing requirements; MarketPlace vs. tied agent structures
- Research: AI in insurance — policy recommendation, churn/lapse prediction
- Execution plan: agent profile (NAICOM-licensed), client policy portfolio, premium tracking, renewal management, AI policy recommendation

---

**3. Implementation workflow:**

Branch: `feat/vertical-insurance-agent` from `main`.

**Schema:**
- `insurance_agent_profiles` — naicom_license, insurer_affiliations JSON, specialty (`life|motor|health|property|all`)
- `client_policies` — agent_id, client_ref, insurer_name, policy_type, policy_number, premium_kobo (P9), coverage_amount_kobo, start_date, renewal_date, status
- `premium_payments` — policy_id, amount_kobo, payment_ref, paid_at, period

**API routes:**
- `GET/PATCH /v/insurance-agent/profile`
- CRUD `/v/insurance-agent/policies`
- `POST /v/insurance-agent/premiums`
- `GET /v/insurance-agent/renewals?days_ahead=30` — upcoming renewals
- `POST /v/insurance-agent/ai/policy-recommendation` — SuperAgent: suggest suitable policy type for client profile (anonymized)

---

**4. QA and verification:**

Minimum 10 test cases — premium in kobo (P9), renewal date alert, client data T3-isolated (P13), AI recommendation uses anonymized data only.

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/insurance-agent): Insurance Agent vertical — policies, premiums, renewals, AI recommendations (M8e)`

---

## TASK V-MED-1: Community Radio / Media House Vertical

- **Module / vertical:** `packages/verticals` + slug `community-radio`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - AI capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian community radio operations (NBC licensing, local FM stations), digital media production, and content scheduling, working on WebWaka OS.

**Skills required:**
- Broadcast schedule management — program slots, live show tracking
- Advertiser/sponsor management — ad bookings (kobo P9)
- Audience engagement — social integration, listener polls
- AI-powered show note generation, ad script drafting (English + Pidgin)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Media / Community Radio entry
- `packages/social/` — listener audience engagement
- `packages/community/` — listener community spaces, live show events

---

**2. Research and execution plan:**

- Research: NBC (National Broadcasting Commission) licensing for community radio in Nigeria
- Research: Nigerian radio advertising market — rates, slot bookings, jingle production
- Research: AI in radio/media — show note generation, ad script creation, news summarization
- Execution plan: station profile (NBC-licensed), program schedule, ad booking, AI script generation

---

**3. Implementation workflow:**

Branch: `feat/vertical-community-radio` from `main`.

**Schema:**
- `radio_profiles` — station_name, nbc_license, frequency, coverage_area, language_primary, community_event_id
- `program_slots` — station_id, program_name, day_of_week, start_time, duration_mins, presenter, format
- `ad_bookings` — station_id, advertiser_name, slot_ids JSON, duration_secs, cost_kobo (P9), start_date, end_date, status
- `content_drafts` — station_id, content_type (`show_note|ad_script|news_brief`), ai_draft TEXT, reviewed INTEGER, approved_content TEXT

**API routes:**
- `GET/PATCH /v/community-radio/profile`
- CRUD `/v/community-radio/schedule`
- CRUD `/v/community-radio/ad-bookings`
- `GET /v/community-radio/revenue?period=` — advertising revenue in kobo
- `POST /v/community-radio/ai/show-notes` — SuperAgent: draft show notes from episode topic
- `POST /v/community-radio/ai/ad-script` — SuperAgent: draft 30-second ad script in English + Pidgin

---

**4. QA and verification:**

Minimum 10 test cases — ad booking cost in kobo (P9), schedule no-overlap validation, AI script draft stored `reviewed: 0`, T3 isolation, AI blocked without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/community-radio): Community Radio vertical — schedule, ads, AI script drafting (M8e)`

---

## TASK V-SOC-1: Startup / Innovation Hub Social Vertical

- **Module / vertical:** `packages/verticals` + slug `startup`
- **Priority:** P3
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Relationships package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/relationships/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian startup ecosystem (Techpoint, Disrupt Africa, Lagos/Abuja tech hubs), startup portfolio management, and investor relations, working on WebWaka OS.

**Skills required:**
- Startup profile — founding team, funding stage, sector, tech stack
- Portfolio management (for hubs/accelerators) — cohort startups, KPIs
- Investor/mentor relationship tracking via `packages/relationships`
- Community integration for startup events, pitch days, hackathons
- AI-powered pitch deck summary and market research briefing

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Social / Startup entry
- `packages/social/` — startup public profile, team posts, thought leadership
- `packages/community/` — startup events, pitch days
- `packages/relationships/` — investor ↔ startup, mentor ↔ founder relationships

---

**2. Research and execution plan:**

- Research: Nigerian startup ecosystem context — Ventures Platform, Founders Factory Africa, Seedstars Lagos
- Research: AI in startup tooling — pitch deck feedback, market research summaries, investor outreach drafts
- Execution plan: startup profile, team management, funding round tracking, hub/cohort management, AI pitch summary

---

**3. Implementation workflow:**

Branch: `feat/vertical-startup` from `main`.

**Schema:**
- `startup_profiles` — startup_name, founding_year, sector, stage (`idea|mvp|growth|scale`), cac_reg, team_size, hq_lga_id
- `funding_rounds` — startup_id, round_type (`pre_seed|seed|series_a|etc`), amount_raised_kobo (P9), lead_investor, closed_at
- `startup_kpis` — startup_id, period (YYYYMM), mrr_kobo, user_count, churn_pct

**API routes:**
- CRUD `/v/startup/profile`
- CRUD `/v/startup/funding-rounds`
- `POST /v/startup/kpis`
- `GET /v/startup/growth-chart?metric=mrr`
- `POST /v/startup/ai/pitch-summary` — SuperAgent: generate 3-sentence investor pitch from startup data
- `POST /v/startup/ai/market-brief` — SuperAgent: summarize target market context for sector + geography

---

**4. QA and verification:**

Minimum 10 test cases — funding amounts in kobo (P9), MRR in kobo, T3 isolation, AI pitch summary uses no founder raw PII (P13).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/startup): Startup vertical — funding, KPIs, AI pitch summary (M8e)`

---

*End of Creator + Professional + Financial + Media + Social Verticals Execution Prompts.*
*Task blocks: V-CRT-1 (Creator — P1), V-CRT-2 (Sole Trader — P1), V-PRO-1 (Professional — P1), V-FIN-1 (Savings Group — P2), V-FIN-2 (Insurance Agent — P2), V-MED-1 (Community Radio — P2), V-SOC-1 (Startup — P3).*
*Additional verticals in each category (Music Studio, Photography, Talent Agency, BDC, Mobile Money, Hire Purchase, Newspaper Dist, Podcast Studio, PR Firm, Book Club) follow the same template.*
