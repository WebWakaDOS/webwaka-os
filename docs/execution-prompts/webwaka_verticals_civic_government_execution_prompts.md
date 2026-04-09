# WebWaka OS — Verticals Execution Prompts: Civic + Politics + Government

**Document type:** Agent execution prompt set  
**Scope:** Civic verticals (13) + Politics verticals (8) + Government/Institutional (3)  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone:** M8b (Politician, Political Party) → M8d (Church, NGO, Cooperative) → M8e (remaining Civic)  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged

---

### General rules for all agents using these prompts

- **Never make assumptions** about WebWaka's architecture or Nigerian civic/political context. Always read the referenced documents and code first.
- **Research Nigerian civic and political context deeply** before implementing any vertical. NGO registration, cooperative law, faith community structures, and LGA governance are domain-specific — do not generalize from Western patterns.
- **All work must be pushed to GitHub.** No local partial work remains outside the repo.
- **SuperAgent is the AI layer** — all AI features route through `packages/superagent`. Never call AI providers directly from vertical code.
- **Platform Invariants are non-negotiable.** P2 (Nigeria First), T3 (tenant isolation), P10 (NDPR consent for AI).
- **Politics-related verticals** have additional sensitivity requirements: AI must not generate political content autonomously (HITL required for L3+ autonomy on political topics).

---

## TASK V-CIV-1: Individual Politician Vertical

- **Module / vertical:** `packages/verticals` + slug `politician`
- **Priority:** P1-Original — must reach production before M10
- **Milestone:** M8b
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Politics package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/politics/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Verticals FSM: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/verticals/src/
  - Verticals dependency DAG: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-dependency-dag.md
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md
  - AI agent autonomy: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-agent-autonomy.md
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - Identity package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian political structures (INEC, LGAs, State Houses of Assembly, NASS), civic tech, and political CRM systems, working on WebWaka OS.

**Skills required:**
- Nigerian political geography — wards, LGAs, constituencies, senatorial districts
- CRM for political campaigns — voter outreach, ward coverage, volunteer management
- Community and social integration — public notices, event management for political meetings
- AI integration for civic outreach content — with HITL (Human-in-the-Loop) requirement for political AI content (L3 autonomy, not autonomous)
- `packages/core/politics` — offices, jurisdictions, assignments, terms schema

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Politics category; Individual Politician entry (P1-Original, M8b); key dependencies
- `docs/governance/verticals-dependency-dag.md` — politician dependencies: politics tables, community, social
- `packages/core/politics/` — offices, jurisdictions, assignments, terms — read ALL source files
- `packages/community/` — spaces, channels, events (political meetings, town halls)
- `packages/social/` — profiles, posts (public political statements)
- `packages/identity/` — BVN/NIN/voter card verification patterns
- `docs/governance/ai-agent-autonomy.md` — autonomy levels; political content is L3 max (HITL required)
- `docs/governance/ai-integration-framework.md` — civic/political AI use cases
- `docs/governance/platform-invariants.md` — P2, P10, P13 (no raw PII to AI), T3

---

**2. Online research and execution plan:**

- Research:
  - INEC ward/constituency/LGA data structure in Nigeria (see INEC Act, geopolitical zone breakdown)
  - Nigerian political CRM patterns — outreach tracking, constituent management
  - AI in political communications — speech drafting, policy summary (note: HITL mandatory)
  - Ethical constraints on AI political content generation (Nigeria Electoral Act, INEC social media policy)
- Execution plan:
  - **Objective:** Register `politician` vertical; implement constituent CRM, ward coverage map, public profile, political event management, and HITL-gated AI speech drafting via SuperAgent
  - **Key steps** (numbered)
  - **Risks:** Political content sensitivity, identity verification integrity, NDPR on voter data

---

**3. Implementation workflow:**

Branch: `feat/vertical-politician` from `main`.

**3.1 Vertical registration:**
- `politician` in FSM registry; entity type: `individual`
- Lifecycle: `seeded → profile_pending → identity_verified → active`
- Required: NIN verification (from `packages/identity`)
- AI autonomy cap: L3 (HITL) for all political content generation

**3.2 Schema additions:**
```sql
CREATE TABLE politician_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  full_name TEXT NOT NULL,
  nin_verified INTEGER NOT NULL DEFAULT 0,
  current_office TEXT,
  party_affiliation TEXT,
  constituency_id TEXT,
  lga_id TEXT,
  state_id TEXT,
  ward_id TEXT,
  bio TEXT,
  photo_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE constituency_coverage (
  id TEXT PRIMARY KEY,
  politician_profile_id TEXT NOT NULL REFERENCES politician_profiles(id),
  ward_id TEXT NOT NULL,
  coverage_status TEXT NOT NULL CHECK (coverage_status IN ('planned', 'active', 'completed')),
  agent_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

**3.3 API routes** (`apps/api/src/routes/verticals/politician.ts`):
- `GET/PATCH /v/politician/profile` — profile management
- `GET /v/politician/wards` — list covered wards with agent counts
- `POST /v/politician/wards/:wardId/coverage` — update coverage status
- `GET /v/politician/events` — list political events (from community package)
- `POST /v/politician/ai/speech-draft` — HITL: SuperAgent drafts speech → stored as `pending_review` → returned to user for approval before publish (L3 autonomy)
- `POST /v/politician/ai/policy-summary` — SuperAgent summarizes policy document (not autonomous publish)

**3.4 AI feature governance:**
- All AI routes: `requireAiRights` + `requireNdprConsent('ai_usage')`
- Political AI content: must include `hitl_required: true` in usage event; content stored as draft (status: `pending_human_review`), never auto-published
- No AI call on USSD sessions (P12)

---

**4. QA and verification:**

Act as a **Senior QA Engineer** with civic tech and political software testing experience.

**Test plan — minimum 14 test cases:**

Positive:
- Profile created with NIN verification required
- Ward coverage update logged correctly
- Speech draft stored as `pending_human_review` (not auto-published)
- Ward coverage scoped to this politician's LGA/constituency

Negative:
- AI speech-draft auto-publish attempt blocked (HITL enforced)
- NDPR consent absent → AI blocked (P10)
- USSD session → AI blocked (P12)
- Cross-tenant ward data inaccessible (T3)

Security:
- Unauthenticated access → 401
- NIN data never returned in API responses (P13)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/politician): Individual Politician vertical — CRM, ward coverage, HITL AI speech drafting (M8b)`
- PR references: verticals master plan P1-Original, AI autonomy doc (L3), platform invariants P10/P12/P13

---

## TASK V-CIV-2: Political Party Vertical

- **Module / vertical:** `packages/verticals` + slug `political-party`
- **Priority:** P1-Original — M8b
- **GitHub context:**
  - (Same politics + community + social refs as V-CIV-1)
  - Relationships package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/relationships/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian political party structures (APC, PDP, LP, NNPP organizational patterns), party membership management, and campaign coordination systems, working on WebWaka OS.

**Skills required:**
- Political party org charts — NEC, BoT, states, LGAs, ward executives
- Membership management — dues collection (kobo P9), membership card issuance
- Inter-entity relationships — party → politician affiliation
- `packages/relationships` — entity-to-entity relationship patterns

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Political Party entry (P1-Original, M8b)
- `packages/core/politics/` — party affiliation schema
- `packages/relationships/` — party ↔ politician affiliation patterns
- `packages/community/` — internal party communications
- `docs/governance/ai-agent-autonomy.md` — L3 max for political content

---

**2. Online research and execution plan:**

- Research: Nigerian political party structures per INEC regulations
- Research: Membership due collection patterns (kiosks, USSD, online — note AI excluded from USSD)
- Execution plan: party profile, ward executive roster, membership management, dues collection, AI briefing generation (HITL)

---

**3. Implementation workflow:**

Branch: `feat/vertical-political-party` from `main`.

**Schema:**
- `party_profiles` — party_name, abbreviation, inec_reg_number, national_chairman, hq_address, state_id
- `party_executives` — party_id, level (`national|state|lga|ward`), title, member_ref, start_date, end_date
- `party_members` — party_id, member_ref, ward_id, membership_number, dues_paid_kobo, membership_status
- `party_meetings` — party_id, title, level, scheduled_at, location, agenda, minutes_draft

**API routes:**
- `GET/PATCH /v/political-party/profile`
- `GET/POST /v/political-party/executives`
- `GET/POST /v/political-party/members`
- `POST /v/political-party/members/:id/dues` — record dues payment (kobo, P9)
- `GET/POST /v/political-party/meetings`
- `POST /v/political-party/ai/meeting-minutes` — HITL: draft meeting minutes from agenda; stored as `pending_review`

---

**4. QA and verification:**

Minimum 12 test cases — dues in integer kobo (P9), executive level validation, T3 isolation, HITL enforcement on AI meeting minutes, NDPR consent check, unauthenticated → 401.

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/political-party): Political Party vertical — membership, executives, HITL AI minutes (M8b)`

---

## TASK V-CIV-3: Church and Faith Community Vertical

- **Module / vertical:** `packages/verticals` + slug `church`
- **Priority:** P1-Original — M8d
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Entitlement model: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/entitlement-model.md
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian faith community management (RCCG, Winners Chapel, CAC, Catholic dioceses) and church management software (ChMS), working on WebWaka OS.

**Skills required:**
- Church membership and pastoral care management
- Tithe and offering tracking (kobo-only, P9) — non-profit accounting patterns
- Community integration for cell groups, departments, programs
- AI-powered sermon outline and announcement generation (not HITL-required for non-political content)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Civic / Church entry (P1-Original, M8d)
- `docs/governance/verticals-dependency-dag.md` — church dependencies (IT-reg, community_spaces)
- `packages/community/` — spaces (branches/parishes), channels (departments/cells), events (services, programs)
- `packages/payments/` — offering/tithe collection
- `docs/governance/ai-integration-framework.md` — community/faith AI use cases
- `docs/governance/platform-invariants.md` — P9 (kobo), T3, P10

---

**2. Online research and execution plan:**

- Research: Nigerian church management software landscape (Planning Center, ChurchSuite, local alternatives)
- Research: Nigerian church structures — RCCG parish model, Anglican diocese, Baptist convention
- Research: AI in faith community management — sermon preparation, pastoral letter generation
- Execution plan: church profile, membership roster, giving records, branch/parish management, AI sermon outline generation

---

**3. Implementation workflow:**

Branch: `feat/vertical-church` from `main`.

**Schema:**
- `church_profiles` — church_name, denomination, it_reg_number, pastor_name, founding_year, branch_count
- `church_members` — workspace-scoped, full_name, contact_ref, department, cell_group, pastoral_status, tithe_number
- `giving_records` — member_ref, type (`tithe|offering|special|project`), amount_kobo (P9), payment_ref, recorded_at
- `church_programs` — name, program_type, scheduled_at, speaker, location, community_event_id

**API routes:**
- `GET/PATCH /v/church/profile`
- `GET/POST /v/church/members`
- `POST /v/church/giving` — record giving (kobo, P9)
- `GET /v/church/giving/summary?member=&period=` — giving summary (integer kobo totals)
- `GET/POST /v/church/programs`
- `POST /v/church/ai/sermon-outline` — SuperAgent: generate 5-point sermon outline from topic/scripture
- `POST /v/church/ai/announcement-draft` — SuperAgent: draft Sunday bulletin announcement in English/Pidgin

---

**4. QA and verification:**

Minimum 12 test cases:
- Tithe amount in integer kobo only (P9)
- Giving summary totals correct in kobo
- Member data scoped to workspace (T3)
- AI sermon outline: blocked without `aiRights`; blocked without NDPR consent (P10)
- Giving records never expose other members' giving (T3)
- Unauthenticated → 401

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/church): Church vertical — membership, giving, programs, AI sermon drafting (M8d)`

---

## TASK V-CIV-4: NGO and Non-Profit Vertical

- **Module / vertical:** `packages/verticals` + slug `ngo`
- **Priority:** P1-Original — M8d
- **GitHub context:**
  - (Same core refs as V-CIV-3)
  - Identity package (for CAC IT-reg): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - Claims package (for beneficiary management): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/claims/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian NGO operations, CAC IT-registration, grant management, and beneficiary tracking, working on WebWaka OS.

**Skills required:**
- NGO program management — projects, activities, beneficiaries, impact metrics
- Grant management — donor tracking, expenditure reporting, M&E (monitoring and evaluation)
- CAC Incorporated Trustee / IT-registration verification
- AI-powered grant proposal writing and impact report generation

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Civic / NGO entry (P1-Original, M8d)
- `packages/identity/` — CAC IT-registration verification patterns
- `packages/claims/` — claims/entitlements patterns (reference for beneficiary tracking)
- `packages/community/` — volunteer coordination, program events
- `docs/governance/ai-integration-framework.md` — civic AI use cases

---

**2. Online research and execution plan:**

- Research: Nigerian NGO management software — IT-registration requirements, SCUML compliance
- Research: Grant management best practices — donor reporting, M&E frameworks (logframe, results framework)
- Research: AI in NGO sector — grant proposal generation, impact report drafting
- Execution plan: NGO profile (CAC IT-reg), program management, beneficiary tracking, donor management, AI grant proposal generation

---

**3. Implementation workflow:**

Branch: `feat/vertical-ngo` from `main`.

**Schema:**
- `ngo_profiles` — org_name, cac_it_reg, scuml_number, mission, beneficiary_type, operating_states JSON
- `ngo_programs` — workspace-scoped, name, goal, start_date, end_date, budget_kobo, status
- `ngo_beneficiaries` — program_id, contact_ref, gender, age_group, location_id, enrollment_date, status
- `ngo_donors` — workspace-scoped, donor_name, type (`individual|institutional|government`), total_donated_kobo, last_donation_at
- `ngo_expenditures` — program_id, description, amount_kobo, receipt_ref, recorded_at

**API routes:**
- `GET/PATCH /v/ngo/profile`
- CRUD `/v/ngo/programs`
- `GET/POST /v/ngo/beneficiaries`
- `GET /v/ngo/impact-summary?program=` — beneficiary count, program reach
- `GET/POST /v/ngo/donors`
- `POST /v/ngo/expenditures`
- `POST /v/ngo/ai/grant-proposal-draft` — SuperAgent: draft grant proposal from program data + donor context (HITL recommended but not required)
- `POST /v/ngo/ai/impact-report-draft` — SuperAgent: draft M&E impact report from beneficiary and expenditure data

---

**4. QA and verification:**

Minimum 12 test cases:
- Program budget in integer kobo (P9)
- Beneficiary data scoped to workspace (T3)
- Expenditure total never exceeds program budget (guard)
- AI grant proposal uses no raw PII (P13)
- AI blocked without NDPR consent (P10)
- CAC IT-reg required before `active` status

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/ngo): NGO vertical — programs, beneficiaries, donors, AI grant proposals (M8d)`

---

## TASK V-CIV-5: Cooperative Society Vertical

- **Module / vertical:** `packages/verticals` + slug `cooperative`
- **Priority:** P1-Original — M8d
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Entitlements package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/entitlements/
  - Identity package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian cooperative society law (Cooperative Societies Act), thrift and credit union operations, and savings group management, working on WebWaka OS.

**Skills required:**
- Cooperative membership management — shares, contributions, loan applications
- Thrift/savings management — weekly/monthly contributions in kobo (P9)
- Loan tracking — disbursement, repayment schedule, interest (integer kobo)
- CAC cooperative registration verification
- AI-powered financial health reporting

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Civic / Cooperative entry (P1-Original, M8d); membership_tiers dependency
- `packages/payments/` — payment link, webhook patterns for contribution collection
- `packages/entitlements/` — membership tier patterns (reference for cooperative membership tiers)
- `docs/governance/platform-invariants.md` — P9 (kobo), T3, T4 (all financial values in kobo)

---

**2. Online research and execution plan:**

- Research: Nigerian cooperative societies law — CAC registration, federal/state cooperative types
- Research: Cooperative financial management — PEARLS ratio framework, loan portfolio health
- Research: AI in cooperative finance — loan default risk scoring, savings pattern analysis
- Execution plan: cooperative profile (CAC reg), member shares, contributions, loan management, AI financial health report

---

**3. Implementation workflow:**

Branch: `feat/vertical-cooperative` from `main`.

**Schema:**
- `cooperative_profiles` — coop_name, cac_reg, coop_type (`thrift|credit|multi_purpose|agriculture`), share_value_kobo, min_shares
- `coop_members` — workspace-scoped, member_ref, share_count, total_contributed_kobo, total_withdrawn_kobo, membership_status
- `coop_contributions` — member_id, period (YYYYMM), amount_kobo (P9), payment_ref, recorded_at
- `coop_loans` — member_id, principal_kobo, interest_rate_bps (basis points, integer), tenure_months, disbursed_at, status, balance_kobo
- `loan_repayments` — loan_id, amount_kobo, recorded_at, reference

**API routes:**
- `GET/PATCH /v/cooperative/profile`
- `GET/POST /v/cooperative/members`
- `POST /v/cooperative/contributions` — record contribution
- `GET /v/cooperative/contributions/summary?member=&year=`
- `POST /v/cooperative/loans` — loan application
- `PATCH /v/cooperative/loans/:id/approve` — committee approval
- `POST /v/cooperative/loans/:id/repayments`
- `POST /v/cooperative/ai/financial-health` — SuperAgent: cooperative balance sheet and loan portfolio health summary

---

**4. QA and verification:**

Minimum 14 test cases:
- Contributions in integer kobo (P9, T4)
- Loan disbursement updates member balance
- Repayment reduces loan balance correctly (integer kobo)
- Loan approval requires committee auth (role check)
- T3: member data isolated per workspace
- Interest rate stored as basis points (integer)
- AI financial health uses no raw member PII (P13)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/cooperative): Cooperative vertical — shares, contributions, loans, AI financial health (M8d)`

---

## TASK V-CIV-6: LGA Office and Government Agency Vertical

- **Module / vertical:** `packages/verticals` + slug `lga-office`
- **Priority:** P3
- **Milestone:** M8b (alongside politics)
- **GitHub context:**
  - Politics package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/politics/
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/geography/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian local government administration, LGA service delivery, and public sector digital transformation, working on WebWaka OS.

**Skills required:**
- LGA organizational structure — chairman, supervisory councillors, departments
- Public service delivery — permit issuance, market levy collection, public notices
- Geography integration (`packages/core/geography`) — ward-level service mapping
- AI-powered public notice drafting and service query routing

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Politics / LGA Office entry
- `packages/core/politics/` — jurisdictions, offices, terms
- `packages/core/geography/` — state → LGA → ward hierarchy
- `packages/community/` — public announcement channels

---

**2. Online research and execution plan:**

- Research: Nigerian LGA structure (Third Schedule, 1999 Constitution) — 774 LGAs
- Research: LGA digital services in Nigeria — LCDA, LGA revenue collection patterns
- Execution plan: LGA profile, department directory, public notice board, service request tracking, levy collection (kobo)

---

**3. Implementation workflow:**

Branch: `feat/vertical-lga-office` from `main`.

**Schema:**
- `lga_profiles` — lga_name, state_id, lga_code (INEC), chairman_name, departments JSON
- `public_notices` — lga_id, title, content, notice_type, published_at, expires_at
- `service_requests` — lga_id, citizen_ref, service_type, status, submitted_at, resolved_at
- `levy_records` — lga_id, payer_ref, levy_type, amount_kobo (P9), period, receipt_number

**API routes:**
- `GET/PATCH /v/lga-office/profile`
- `GET/POST /v/lga-office/notices`
- `GET/POST /v/lga-office/service-requests`
- `GET/POST /v/lga-office/levies`
- `POST /v/lga-office/ai/notice-draft` — SuperAgent: draft public notice in formal English

---

**4. QA and verification:**

Minimum 10 test cases — levy amounts in kobo (P9), public notices visible without auth (public endpoint), service request T3 isolation, AI notice draft blocked without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/lga-office): LGA Office vertical — notices, service requests, levy collection (M8b)`

---

*End of Civic + Politics + Government Verticals Execution Prompts.*
*Task blocks: V-CIV-1 (Politician — P1), V-CIV-2 (Political Party — P1), V-CIV-3 (Church — P1), V-CIV-4 (NGO — P1), V-CIV-5 (Cooperative — P1), V-CIV-6 (LGA Office — P3).*
*Additional civic verticals (Mosque, Youth Org, Women's Association, Polling Unit, Sports Club) follow the same template.*
