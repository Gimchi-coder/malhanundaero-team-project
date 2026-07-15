# Tasks: 동네 광장 안전한 동네 모임

**Input**: Design documents from `/specs/001-dongne-gwangjang/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Verification is required for safety, privacy, authentication, moderation, and data
integrity behavior. Browser/demo tests are used where no test runner exists yet.

**Organization**: Tasks are grouped by user story and ordered by dependency.

## Phase 1: Setup

- [x] T001 Create the feature validation structure in `tests/` and document the local static-server command in `specs/001-dongne-gwangjang/quickstart.md`
- [x] T002 [P] Add a repository `.gitignore` covering `.DS_Store`, `.env*`, credentials, logs, and build artifacts in `.gitignore`
- [x] T003 [P] Add a non-secret configuration contract and placeholder validation in `config.js`

## Phase 2: Foundational

- [x] T004 Define canonical activity, user projection, participation, review, and safety-review states in `main.js`
- [x] T005 [P] Implement an adapter boundary for mock persistence, future Supabase persistence, and realtime updates in `main.js`
- [x] T006 [P] Implement public/private user projection helpers that exclude real identity and secrets in `main.js`
- [x] T007 Implement deterministic safety-text normalization and category detection for spacing, punctuation, and obfuscation in `main.js`
- [x] T008 Add loading, error, retry, held, empty, cancelled, full, and duplicate-operation UI state surfaces in `index.html` and `style.css`
- [x] T009 Add a protected-provider integration boundary contract and secret-handling documentation in `specs/001-dongne-gwangjang/contracts/safety-review.md`

## Phase 3: User Story 1 - Browse and join a safe neighborhood activity (Priority: P1)

**Goal**: Let an authenticated user discover and join recruiting activities without exposing
private identity data.

**Independent Test**: Two local browser sessions can view activities, join without duplication,
and observe participant state changes while cancelled/full activities reject new joins.

- [x] T010 [US1] Render only recruiting activities with purpose, time, public location, count, and limit in `main.js`
- [x] T011 [US1] Add activity detail, participant projection, join, duplicate, full, cancelled, and join-cancel states in `index.html`, `main.js`, and `style.css`
- [x] T012 [US1] Enforce unique participation and capacity checks in the persistence adapter in `main.js`
- [x] T013 [US1] Add deterministic browser journey coverage for browse, join, empty state, duplicate join, and full activity in `tests/validation.md`

## Phase 4: User Story 2 - Create an activity with privacy-preserving identity (Priority: P1)

**Goal**: Let authenticated users create a bounded public activity using nickname-based public
identity and a safety-review lifecycle.

**Independent Test**: A user submits valid and invalid activity forms, sees review progress,
and public UI never renders private identity fields.

- [x] T014 [US2] Add required purpose, description, public location, scheduled time, and 3–6 participant-limit fields in `index.html`
- [x] T015 [US2] Validate future time, public-location rules, participant bounds, and authenticated creation in `main.js`
- [x] T016 [US2] Render nickname/icon/trust projection and remove private identity exposure from all public activity and participant templates in `main.js`
- [x] T017 [US2] Add privacy and form-validation checks covering missing fields, unsafe location, invalid limit, and secret exposure in `tests/validation.md`

## Phase 5: User Story 3 - Prevent harmful or off-purpose activities (Priority: P1)

**Goal**: Hold unsafe or uncertain activity submissions and provide understandable correction
guidance without silently publishing them.

**Independent Test**: A labeled fixture set of safe, direct-risk, and obfuscated-risk text yields
the expected approve/hold result and the UI provides retry guidance.

- [x] T018 [US3] Integrate the safety adapter with approved, held, manual-review, and unavailable outcomes in `main.js`
- [x] T019 [US3] Add category-specific, non-stigmatizing revision guidance to the held-review surface in `main.js` and `index.html`
- [x] T020 [US3] Ensure review dependency failure holds the activity and exposes retry/manual review instead of publishing in `main.js`
- [x] T021 [US3] Create the 50-case safety fixture matrix and expected decisions in `tests/safety-review-fixtures.json`
- [x] T022 [US3] Add repeatable safety-review validation instructions and observed-result format in `tests/validation.md`

## Phase 6: User Story 4 - Record behavior-based trust after an activity (Priority: P2)

**Goal**: Provide one behavior-only review after completion and update trust without appearance
or romantic scoring.

**Independent Test**: A completed activity exposes only behavior dimensions, accepts one review,
rejects duplicates/self-review, and updates the trust projection.

- [x] T023 [US4] Add completed-activity feedback UI with punctuality, courtesy, and rule-adherence dimensions in `index.html` and `style.css`
- [x] T024 [US4] Implement one-review-per-participant, no-self-review, and trust-projection update rules in `main.js`
- [x] T025 [US4] Add behavior-review privacy and duplicate-submission checks in `tests/validation.md`

## Phase 7: Polish and Cross-Cutting Validation

- [x] T026 [P] Add scheduled cancellation logic for fewer-than-three participants at the two-hour threshold in `main.js`
- [x] T027 [P] Add explicit cancellation warning and recovery messaging for affected participants in `index.html` and `main.js`
- [x] T028 [P] Add responsive accessibility states, keyboard focus visibility, and reduced-motion handling in `style.css`
- [x] T029 Verify no browser-delivered configuration contains a real provider secret and document the production boundary in `config.js` and `specs/001-dongne-gwangjang/quickstart.md`
- [x] T030 Run all quickstart scenarios and record pass/fail evidence in `tests/validation.md`

## Phase 10: Code-first automation replacement

- [x] T050 Add a Vercel-compatible server endpoint with the existing automation input/output contract in api/automation.js
- [x] T051 Add embedding-based activity document retrieval, cosine ranking, grounded recommendation generation, and candidate-ID validation in api/_lib/automation.js and api/_lib/provider.js
- [x] T052 Add deterministic safety gates, context-classification prompts, confidence handling, and fail-closed provider behavior in api/_lib/automation.js and api/automation.js
- [x] T053 Add automation mode switching, code-path documentation, and pure-function verification without exposing provider secrets in config.js, main.js, docs/code-automation.md, and tests/code-automation.mjs
- [x] T054 Activate the Vercel code endpoint, add a semantic-vector fallback for restricted embedding credentials, and verify live safe, risky, and recommendation requests

## Dependencies & Execution Order

- Setup (Phase 1) precedes all other phases.
- Foundational (Phase 2) blocks all user stories.
- User Stories 1–3 are P1 and depend on Phase 2; they can proceed in parallel only when they
  touch different files or adapters.
- User Story 4 depends on the activity lifecycle from User Story 1.
- Polish depends on the desired user stories, with T026 required before cancellation validation.
- T021 must precede T022; T018–T020 must precede T022.
- T012 must be complete before realtime/concurrency evidence is accepted.

## Implementation Strategy

Deliver the P1 browse/join, creation/privacy, and safety-review slices first using the existing
mock mode. Then add scheduled cancellation and behavior feedback. A protected backend and real
Supabase integration remain required before production deployment, even if the local prototype
uses the adapter’s deterministic mock implementation.

## Phase 8: Convergence

- [x] T031 Add a protected server-side safety-review endpoint that owns provider credentials and returns the documented review contract per Constitution IV and plan: protected server boundary (Censorship_Agent gateway)
- [ ] T032 Move the two-hour underfilled-activity cancellation invariant to a scheduled server job or database function and publish its result through the persistence boundary per FR-006 and Constitution III (partial)
- [ ] T033 Implement Supabase Auth, activity persistence, unique participation/capacity enforcement, and Realtime subscription behind the adapter per plan: Supabase dependencies and SC-002/SC-004 (missing)
- [ ] T034 Re-review edited activity content before it remains recruiting and expose the correction path per FR-013 (missing)
- [ ] T035 Add a completed-activity entry point that invokes the behavior-review UI for eligible participants per US4/AC1 (partial)

## Phase 9: Course and Evaluation Alignment

**Goal**: Close the remaining gaps needed to demonstrate the course workflow and supplied
evaluation rubric without adding unrelated product scope.

- [x] T036 [P] Add the course-aligned recommendation, semantic moderation, n8n automation, and rubric evidence requirements to `team_prd.md` and `specs/001-dongne-gwangjang/spec.md`
- [x] T037 [P] Document the automation boundary, fallback policy, observability fields, and rubric evidence in `specs/001-dongne-gwangjang/plan.md`, `specs/001-dongne-gwangjang/research.md`, and `specs/001-dongne-gwangjang/contracts/automation.md`
- [x] T038 [P] Define recommendation, safety-review, operation-log, and prompt-policy entities and state transitions in `specs/001-dongne-gwangjang/data-model.md`
- [x] T039 [P] Add an importable n8n workflow artifact with webhook input, validation, normalization, semantic-review boundary, explicit branches, and response contract in `n8n/workflows/activity-safety-and-recommendation.json`
- [x] T040 Add a browser-safe automation adapter with schema validation, retry, unavailable/manual-review handling, and privacy-safe operation logging in `main.js` and `config.js`
- [x] T041 [US5] Add preference capture, context-aware recommendation cards, reason display, and empty/clarifying states in `index.html`, `main.js`, and `style.css`
- [x] T042 [US6] Extend safety screening with layered normalization, indirect-intent fixtures, confidence bands, manual-review routing, and non-stigmatizing correction guidance in `main.js`, `index.html`, and `tests/safety-review-fixtures.json`
- [x] T043 [US7] Add versioned recommendation/safety policies, baseline-versus-candidate evaluation, latency/outcome metrics, and privacy-safe evidence output in `tests/evaluate.mjs`, `tests/evaluation-fixtures.json`, and `tests/validation.md`
- [x] T044 [P] Add browser-level checks for recommendation relevance, semantic moderation, fail-closed behavior, privacy projection, and retry/manual-review paths in `tests/validation.md`
- [x] T045 Run syntax, diff, fixture, quickstart, and n8n JSON validation; record rubric evidence and remaining limitations in `specs/001-dongne-gwangjang/quickstart.md` and `tests/validation.md`
- [x] T046 [US5] Connect recommendation requests to the protected automation endpoint when configured, with local grounded fallback, exact-match cache, and route selection in `main.js` and `config.js`
- [x] T047 [US6] Add visible workflow stages and operation metrics for validation, semantic review, decision routing, and privacy-safe logging in `index.html`, `style.css`, and `main.js`
- [x] T048 [US7] Add input-injection guardrails, PII masking fixtures, and recommendation execution evaluation rather than expectation-only checks in `main.js`, `tests/guardrail-fixtures.json`, and `tests/evaluate.mjs`
- [x] T049 [P] Extend the n8n contract workflow to pass recommendation activity context and return recommendation responses through the same protected boundary in `n8n/workflows/activity-safety-and-recommendation.json`
