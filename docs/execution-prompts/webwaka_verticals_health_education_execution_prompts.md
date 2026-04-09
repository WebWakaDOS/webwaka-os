# WebWaka OS — Verticals Execution Prompts: Health + Education

**Document type:** Agent execution prompt set  
**Scope:** Health verticals (9) + Education verticals (8)  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone:** M8e  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged

---

### General rules for all agents using these prompts

- **Never make assumptions** about Nigerian healthcare regulations or education policy. Always read referenced documents and code first.
- **Health verticals carry heightened data sensitivity.** NDPR + HIPAA-equivalent patterns apply. Patient data must never be sent to AI providers in raw form — only anonymized, aggregated data (P13).
- **All AI in health verticals requires explicit consent** (P10) and must use HITL (Human-in-the-Loop) for any clinical content (AI autonomy level L3 maximum — read `docs/governance/ai-agent-autonomy.md`).
- **Education verticals** serve children and students — content policies apply; AI content generation must be age-appropriate.
- **All financial values in kobo** (P9, T4) — consultation fees, school fees, prescription charges.
- **SuperAgent is the AI layer** — all AI routes go through `packages/superagent`. Never call AI providers directly from vertical code.

---

## TASK V-HLT-1: Clinic / Healthcare Facility Vertical

- **Module / vertical:** `packages/verticals` + slug `clinic`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Verticals dependency DAG: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-dependency-dag.md
  - Identity package (CAC + license): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - OTP package (appointment reminders): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/otp/
  - Contact package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/contact/
  - AI agent autonomy: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-agent-autonomy.md
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian primary healthcare systems (NHIA, FMoH guidelines), clinic management software, and health informatics, working on WebWaka OS.

**Skills required:**
- Electronic Medical Records (EMR) — patient registration, consultation notes, prescription records
- Nigerian healthcare regulation — MDCNlicensure, NAFDAC compliance, NHIA billing
- Appointment scheduling and reminder system (via `packages/otp`)
- NDPR-compliant health data handling — patient data is special category data
- AI-assisted clinical documentation (HITL only — L3 autonomy max)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Health / Clinic entry (P1-Original, M8e); license verification dependency
- `docs/governance/verticals-dependency-dag.md` — clinic dependencies
- `packages/identity/` — MDCN license verification patterns (doctor registration numbers)
- `packages/otp/` — SMS/WhatsApp appointment reminder patterns
- `packages/contact/` — patient contact channel management
- `docs/governance/ai-agent-autonomy.md` — clinical AI is L3 (HITL mandatory)
- `docs/governance/platform-invariants.md` — P10 (NDPR consent for patient data), P13 (no raw patient data to AI), T3
- `docs/governance/ai-integration-framework.md` — health AI use cases

---

**2. Online research and execution plan:**

- Research:
  - Nigerian primary healthcare management software (DrCare, ClinicPro patterns)
  - NHIA outpatient billing codes and tariff structure
  - NDPR special category data rules for health records
  - AI in clinical documentation — SOAP note drafting (always HITL — never autonomous clinical advice)
  - MDCN verification API availability (and offline fallback)
- Execution plan:
  - **Objective:** Register `clinic` vertical; implement patient records, appointments, consultations, prescriptions (with NAFDAC drug codes), billing (kobo), and HITL AI clinical note drafting
  - **Key steps** (numbered)
  - **Risks:** Patient data sensitivity — strict NDPR controls; MDCN API offline fallback

---

**3. Implementation workflow:**

Branch: `feat/vertical-clinic` from `main`.

**3.1 Vertical registration:**
- `clinic` in FSM registry; entity type: `organization`
- Lifecycle: `seeded → license_verified → active`
- Required: MDCN registration verification

**3.2 Schema additions:**
```sql
CREATE TABLE clinic_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  clinic_name TEXT NOT NULL,
  cac_reg TEXT,
  mdcn_reg TEXT NOT NULL,
  nhia_code TEXT,
  specialty TEXT,
  bed_count INTEGER NOT NULL DEFAULT 0,
  consultation_fee_kobo INTEGER NOT NULL DEFAULT 0 CHECK (consultation_fee_kobo >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE clinic_patients (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinic_profiles(id),
  tenant_id TEXT NOT NULL,
  folder_number TEXT NOT NULL,
  full_name_hash TEXT NOT NULL,
  contact_ref TEXT,
  dob_year INTEGER,
  gender TEXT CHECK (gender IN ('M', 'F', 'O')),
  blood_group TEXT,
  genotype TEXT,
  allergy_notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_patient_folder ON clinic_patients (clinic_id, folder_number);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinic_profiles(id),
  patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
  doctor_name TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('consultation', 'follow_up', 'procedure', 'lab')),
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE consultation_records (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinic_profiles(id),
  patient_id TEXT NOT NULL REFERENCES clinic_patients(id),
  appointment_id TEXT,
  doctor_name TEXT NOT NULL,
  chief_complaint TEXT NOT NULL,
  clinical_notes TEXT,
  ai_draft_notes TEXT,
  ai_draft_reviewed INTEGER NOT NULL DEFAULT 0,
  diagnosis_codes JSON,
  consultation_fee_kobo INTEGER NOT NULL CHECK (consultation_fee_kobo >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultation_records(id),
  clinic_id TEXT NOT NULL REFERENCES clinic_profiles(id),
  drug_name TEXT NOT NULL,
  nafdac_code TEXT,
  dosage TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_kobo INTEGER NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
  dispensed INTEGER NOT NULL DEFAULT 0
);
```

**3.3 API routes** (`apps/api/src/routes/verticals/clinic.ts`):
- `GET/PATCH /v/clinic/profile`
- `GET/POST /v/clinic/patients` — patient registration with anonymized storage
- `GET/POST /v/clinic/appointments` — appointment booking
- `PATCH /v/clinic/appointments/:id/status` — status transitions
- `POST /v/clinic/consultations` — create consultation record
- `GET/POST /v/clinic/prescriptions` — prescription management
- `GET /v/clinic/billing/summary?period=` — revenue in kobo
- `POST /v/clinic/ai/soap-draft` — HITL: SuperAgent drafts SOAP note from chief complaint → stored as `ai_draft_notes`, `ai_draft_reviewed: false`; doctor must explicitly approve before it becomes `clinical_notes`

**3.4 Data sensitivity controls:**
- Patient `full_name` stored as SHA-256 hash in `full_name_hash` (P13 — no raw PII to AI)
- AI SOAP draft uses only chief complaint text and anonymous clinical context — never sends patient name, DOB, or contact (P13)
- All clinic routes require auth + NDPR consent (P10)

---

**4. QA and verification:**

Minimum 15 test cases:

Positive:
- Patient registered with hashed name (P13 verified)
- Appointment status transitions follow FSM
- Consultation fee in integer kobo (P9)
- AI SOAP draft stored as `ai_draft_reviewed: false` (never auto-approved)

Negative:
- SOAP draft auto-approve attempt blocked (HITL enforced)
- AI called with raw patient name → rejected (P13)
- AI blocked without NDPR consent (P10)
- AI blocked on USSD session (P12)
- Fractional kobo fee rejected (P9/T4)

Security:
- Patient folder data inaccessible cross-tenant (T3)
- Unauthenticated → 401
- Patient name hash not reversible in API response

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/clinic): Clinic vertical — patients, appointments, consultations, HITL AI SOAP drafting (M8e)`
- PR references: AI autonomy doc (L3 HITL), platform invariants P10/P13/T3

---

## TASK V-HLT-2: Pharmacy Vertical

- **Module / vertical:** `packages/verticals` + slug `pharmacy`
- **Priority:** P2-Top100
- **GitHub context:**
  - (Same core refs as V-HLT-1)
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian pharmacy operations, NAFDAC drug regulations, and PCN (Pharmacy Council of Nigeria) licensing, working on WebWaka OS.

**Skills required:**
- Pharmacy inventory — drug stock management by NAFDAC code, batch/expiry tracking
- Prescription dispensing workflow — prescription verification, dispensing record, payment
- PCN license verification, NAFDAC approved drug list
- AI-powered expiry alert and stock reorder recommendations

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Health / Pharmacy entry
- `packages/identity/` — PCN license verification patterns
- `docs/governance/platform-invariants.md` — P9 (kobo for all drug prices), P13 (no patient drug history raw data to AI)

---

**2. Online research and execution plan:**

- Research: Nigerian pharmacy management software (RxEasy, PharmConnect patterns)
- Research: NAFDAC drug register and code format
- Research: AI in pharmacy — expiry alert optimization, reorder forecasting
- Execution plan: pharmacy profile (PCN-licensed), drug inventory by NAFDAC code, dispensing records, expiry tracking, AI reorder advisory

---

**3. Implementation workflow:**

Branch: `feat/vertical-pharmacy` from `main`.

**Schema:**
- `pharmacy_profiles` — pharmacy_name, pcn_reg, nafdac_store_reg, premises_license, dispensing_class
- `drug_inventory` — workspace-scoped, nafdac_code, drug_name, generic_name, form, strength, batch_number, expiry_date, quantity_units, unit_cost_kobo, selling_price_kobo
- `dispensing_records` — prescription_ref (external), patient_anonymous_ref, drug_id, quantity_dispensed, total_kobo, dispensed_at
- `expiry_alerts` — drug_id, days_to_expiry, alert_triggered_at, resolved_at

**API routes:**
- `GET/PATCH /v/pharmacy/profile`
- CRUD `/v/pharmacy/drugs`
- `POST /v/pharmacy/dispense` — dispense from stock, create dispensing record
- `GET /v/pharmacy/expiry-alerts` — drugs expiring within threshold
- `GET /v/pharmacy/stock-value` — total stock value in kobo
- `POST /v/pharmacy/ai/reorder-plan` — SuperAgent: reorder recommendations from stock levels and dispensing velocity

---

**4. QA and verification:**

Minimum 12 test cases — drug prices in kobo (P9), dispensing decrements stock, expiry alert fires at threshold, AI reorder blocked without consent (P10), patient anonymous ref never contains raw patient name (P13).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/pharmacy): Pharmacy vertical — drug inventory, dispensing, AI reorder (M8e)`

---

## TASK V-HLT-3: Gym / Fitness Center Vertical

- **Module / vertical:** `packages/verticals` + slug `gym`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Entitlements package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/entitlements/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian fitness industry operations (gym management, personal training), membership management, and wellness SaaS, working on WebWaka OS.

**Skills required:**
- Membership tiers — monthly, quarterly, annual subscriptions (all in kobo P9)
- Class/session scheduling and booking
- AI-powered workout plan generation and progress tracking

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Health / Gym entry
- `packages/entitlements/` — membership tier patterns (analogous for gym memberships)
- `packages/community/` — class schedules, group sessions as community events

---

**2. Online research and execution plan:**

- Research: Nigerian gym market — typical membership tiers, class types (aerobics, yoga, weights)
- Research: AI in fitness — personalized workout plan generation, progress analysis
- Execution plan: gym profile, membership plans, class scheduling, attendance, AI workout plan

---

**3. Implementation workflow:**

Branch: `feat/vertical-gym` from `main`.

**Schema:**
- `gym_profiles` — gym_name, equipment_list JSON, class_types JSON, capacity
- `gym_memberships` — member_ref, plan (`monthly|quarterly|annual`), amount_paid_kobo, start_date, end_date, status
- `gym_classes` — class_type, instructor, scheduled_at, max_capacity, enrolled_count
- `class_bookings` — class_id, member_id, status (`booked|attended|cancelled`)
- `member_progress` — member_id, metrics JSON (weight_kg, body_fat_pct, notes), recorded_at

**API routes:**
- CRUD `/v/gym/memberships`
- CRUD `/v/gym/classes`
- `POST /v/gym/classes/:id/book`
- `POST /v/gym/progress` — log progress metrics
- `GET /v/gym/progress?member=`
- `POST /v/gym/ai/workout-plan` — SuperAgent: generate personalized weekly workout plan from progress data

---

**4. QA and verification:**

Minimum 10 test cases — membership amounts in kobo (P9), class capacity enforcement, progress data T3-isolated, AI workout plan blocked without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/gym): Gym vertical — memberships, classes, progress tracking, AI workout plans (M8e)`

---

## TASK V-EDU-1: School / Educational Institution Vertical

- **Module / vertical:** `packages/verticals` + slug `school`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Community package (for courses): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Identity package (CAC): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - AI agent autonomy: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-agent-autonomy.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian school management systems (SUBEB, private schools, WAEC/NECO curriculum), school fee collection, and EdTech platforms, working on WebWaka OS.

**Skills required:**
- Student enrollment and academic record management
- School fee billing (kobo P9) — term-based, sibling discount support
- Nigerian curriculum alignment — NERDC curriculum, WAEC/JAMB subject structures
- Community integration for courses, events, and parent communication
- AI-powered lesson plan generation and student report drafting (HITL for academic assessments)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Education / School (P1-Original, M8e); CAC, community_courses dependency
- `packages/community/` — courses, events (school programs)
- `packages/payments/` — school fee payment and webhook
- `docs/governance/ai-agent-autonomy.md` — L3 HITL for student assessment content
- `docs/governance/platform-invariants.md` — P9, P13 (student data protection), T3

---

**2. Online research and execution plan:**

- Research: Nigerian private school software (SchoolFeedback, Schoolable patterns)
- Research: Nigerian curriculum structure — JSS, SSS, Primary levels; WAEC subjects
- Research: AI in education — lesson plan generation, student report card drafting (teacher reviews before publish)
- Execution plan: school profile (CAC), class/student management, fee billing, examination results, AI lesson plan and report card drafting

---

**3. Implementation workflow:**

Branch: `feat/vertical-school` from `main`.

**Schema:**
- `school_profiles` — school_name, cac_reg, proprietor_type (`private|mission|government`), school_type (`primary|secondary|both`), student_count
- `school_classes` — workspace-scoped, class_name, level (`primary|jss|sss`), year, teacher_name, student_count
- `students` — class_id, folder_number, full_name_hash (P13), dob_year, gender, guardian_contact_ref, enrollment_date, status
- `fee_bills` — student_id, term, session, amount_kobo (P9), amount_paid_kobo, due_date, status
- `exam_results` — student_id, term, session, subject, score (0-100), grade, teacher_remarks
- `school_events` — name, event_type, scheduled_at, description, community_event_id

**API routes:**
- `GET/PATCH /v/school/profile`
- CRUD `/v/school/classes`
- `GET/POST /v/school/students`
- `GET/POST /v/school/fee-bills`
- `POST /v/school/fee-bills/:id/pay` — record payment in kobo
- `GET/POST /v/school/exam-results`
- `POST /v/school/ai/lesson-plan` — SuperAgent: draft lesson plan for subject/topic (teacher reviews before use)
- `POST /v/school/ai/report-card-narrative` — SuperAgent: draft student narrative report from scores (teacher approves before publishing — HITL)

---

**4. QA and verification:**

Minimum 14 test cases:
- Fee amounts in integer kobo (P9)
- Student names stored as hash (P13)
- AI report card draft stored as `pending_review` (HITL — never auto-published)
- Exam scores bounded 0–100
- Fee bill payment updates `amount_paid_kobo` correctly
- T3: student data isolated per workspace
- AI blocked without NDPR consent (P10); on USSD (P12)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/school): School vertical — students, fees, results, HITL AI lesson plans (M8e)`

---

## TASK V-EDU-2: Vocational Training Center / Driving School Vertical

- **Module / vertical:** `packages/verticals` + slug `vocational-center`
- **Priority:** P2-Top100
- **GitHub context:**
  - (Same core refs as V-EDU-1)
  - FRSC package (for driving school licensing): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian vocational training (NABTEB, ITF-accredited centers, FRSC driving schools) and skills certification, working on WebWaka OS.

**Skills required:**
- Course and cohort management — intake batches, class scheduling
- Skills certification — certificate issuance and verification
- FRSC driving school licensing (for driving school sub-type)
- AI-powered curriculum design and trainee progress reporting

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Education / Vocational / Driving School entries
- `packages/community/` — courses (vocational training courses)
- `packages/identity/` — NABTEB/ITF and FRSC accreditation verification

---

**2. Online research and execution plan:**

- Research: ITF (Industrial Training Fund) accreditation for vocational centers in Nigeria
- Research: FRSC driving school licensing requirements (LDT number)
- Research: AI in vocational training — personalized learning path, skills gap analysis
- Execution plan: center profile (ITF/FRSC-accredited), intake batches, trainees, certification, AI skills assessment

---

**3. Implementation workflow:**

Branch: `feat/vertical-vocational` from `main`.

**Schema:**
- `vocational_profiles` — center_name, accreditation_body (`itf|nabteb|frsc`), accreditation_number, trades JSON
- `training_cohorts` — course_name, trade, start_date, end_date, capacity, trainer_name
- `trainees` — cohort_id, trainee_ref, enrollment_date, status, attendance_pct, final_score
- `certificates` — trainee_id, cohort_id, cert_number, issued_at, verification_url

**API routes:**
- CRUD `/v/vocational/cohorts`
- `GET/POST /v/vocational/trainees`
- `POST /v/vocational/trainees/:id/grade`
- `POST /v/vocational/certificates/issue`
- `GET /v/vocational/certificates/verify?cert=` — public endpoint
- `POST /v/vocational/ai/learning-path` — SuperAgent: generate personalized learning path from trainee skill assessment

---

**4. QA and verification:**

Minimum 10 test cases — certificate issued only after minimum score, verification endpoint is public (no auth), T3 isolation on trainee records, AI learning path blocked without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/vocational): Vocational Center vertical — cohorts, trainees, certs, AI learning path (M8e)`

---

## TASK V-EDU-3: Tutoring and After-School Center Vertical

- **Module / vertical:** `packages/verticals` + slug `tutoring`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - OTP package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/otp/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian private tutoring market, WAEC/JAMB preparation, and EdTech micro-platforms, working on WebWaka OS.

**Skills required:**
- Tutoring session management — 1-on-1 and group sessions, scheduling
- Student progress tracking — subject scores, weak area identification
- WAEC/JAMB subject curriculum mapping
- AI-powered practice question generation and performance analysis (HITL for student assessment)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Education / Tutoring entry
- `packages/community/` — group tutoring sessions as community events

---

**2. Research and execution plan:**

- Research: Nigerian tutoring market — Clasam, Tuteria patterns
- Research: WAEC/JAMB syllabus structure and subject codes
- Execution plan: tutoring center profile, subject catalog, session booking, progress tracking, AI practice questions

---

**3. Implementation workflow:**

Branch: `feat/vertical-tutoring` from `main`.

**Schema + API routes** following V-EDU-1 pattern:
- `tutoring_profiles`, `tutors`, `subjects`, `tutoring_sessions`, `session_bookings`, `student_progress`
- CRUD for all entities; session booking FSM; progress tracking per subject
- `POST /v/tutoring/ai/practice-questions` — SuperAgent: generate 10 practice questions for subject/topic
- `POST /v/tutoring/ai/progress-analysis` — SuperAgent: identify weak areas from score history (advisory; parent reviews)

---

**4. QA + push:**

Minimum 10 test cases. Commit: `feat(vertical/tutoring): Tutoring vertical — sessions, progress, AI practice questions (M8e)`

---

*End of Health + Education Verticals Execution Prompts.*
*Task blocks: V-HLT-1 (Clinic — P1), V-HLT-2 (Pharmacy — P2), V-HLT-3 (Gym — P2), V-EDU-1 (School — P1), V-EDU-2 (Vocational Center — P2), V-EDU-3 (Tutoring — P2).*
*Additional health verticals (Dental, Vet, Rehab, CHW Network) and education verticals (Crèche) follow the same template.*
