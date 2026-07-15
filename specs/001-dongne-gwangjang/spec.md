# Feature Specification: 동네 광장 안전한 동네 모임

**Feature Branch**: `001-dongne-gwangjang`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: Build the “동네 광장” neighborhood group activity service from the supplied PRD, SPEC, implementation plan, workflow, frontend walkthrough, and current HTML/CSS/JavaScript files.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and join a safe neighborhood activity (Priority: P1)

As a neighborhood resident who wants low-pressure social contact, I can browse purpose-led
group activities without seeing profile photos, gender filters, or romantic matching signals,
review the activity details, and request participation.

**Why this priority**: Discovering and joining an activity is the smallest complete journey
that provides the service’s core value.

**Independent Test**: A signed-in user can view recruiting activities, inspect purpose, time,
public place, and participant count, then join an activity; the UI reflects the updated
participant count without exposing private identity data.

**Acceptance Scenarios**:

1. **Given** recruiting activities exist, **When** a visitor opens the service, **Then** only
   recruiting activities are listed with purpose, time, public location, and participant count.
2. **Given** an authenticated user views a recruiting activity, **When** the user joins it,
   **Then** the participant count updates and the user can see that they are participating.
3. **Given** an activity has fewer than three confirmed participants two hours before its
   start, **When** the scheduled safety check runs, **Then** the activity becomes cancelled and
   affected participants receive a clear cancellation message.

### User Story 2 - Create an activity with privacy-preserving identity (Priority: P1)

As an authenticated user, I can create a small group activity using a nickname and behavior-
based trust score while keeping real identity data private from other participants.

**Why this priority**: Activity creation supplies the inventory that makes discovery useful,
while the privacy boundary is central to the product differentiation.

**Independent Test**: An authenticated user submits a purpose, description, date/time, public
location, and participant limit; the system accepts or holds the activity and the UI never
renders the user’s real name, email, gender, or age.

**Acceptance Scenarios**:

1. **Given** an authenticated user opens activity creation, **When** the user submits all
   required fields, **Then** the request enters safety review and the user receives a visible
   processing state.
2. **Given** an activity passes safety review, **When** the review completes, **Then** the
   activity is published with a recruiting state and a participant limit between three and six.
3. **Given** a user submits an activity with a private or unsafe meeting place, **When** the
   request is evaluated, **Then** it is not published and the user receives a correction path.

### User Story 3 - Prevent harmful or off-purpose activities (Priority: P1)

As a participant, I can trust that activity content is screened for dating solicitation,
harassment, scams, sales or investment promotion, and religious proselytizing, including
common obfuscated wording.

**Why this priority**: The service’s primary promise is safe group participation rather than
unmoderated anonymity.

**Independent Test**: A review set containing safe activities and disallowed or obfuscated
phrases produces a review result; unsafe submissions are held with an understandable reason
and safe submissions can proceed.

**Acceptance Scenarios**:

1. **Given** activity text indicates dating, gender-ratio selection, sales, investment,
   recruitment, or proselytizing intent, **When** safety review completes, **Then** the
   activity is held and the creator receives a specific revision suggestion.
2. **Given** disallowed intent is written with spacing, punctuation, or synonymous wording,
   **When** safety review completes, **Then** it is treated as the corresponding unsafe
   category rather than bypassing review.
3. **Given** the safety-review dependency is unavailable, **When** the user submits an
   activity, **Then** the activity is not silently published and the user receives a retry or
   manual-review path.

### User Story 4 - Record behavior-based trust after an activity (Priority: P2)

As a participant, I can provide behavior-based feedback after a completed activity without
rating appearance, credentials, or romantic suitability.

**Why this priority**: Trust feedback supports safer repeat participation but is not required
to validate the initial browse-and-join experience.

**Independent Test**: After a completed activity, each participant can submit behavior-based
feedback once; the resulting trust score change is visible only through the permitted public
trust indicator and repeated harmful behavior can restrict future participation.

**Acceptance Scenarios**:

1. **Given** an activity has ended, **When** an eligible participant opens feedback, **Then**
   only behavior dimensions such as punctuality, courtesy, and rule adherence are offered.
2. **Given** a participant submits feedback, **When** the submission is accepted, **Then** it
   cannot be duplicated and the affected trust indicator is recalculated.

### Edge Cases

- A visitor who is not authenticated cannot join or create an activity and receives a clear
  authentication prompt.
- A user cannot join the same activity twice, join a cancelled/full activity, or exceed the
  configured participant limit.
- No recruiting activities exist: the service presents a useful empty state and a safe path to
  sign in or create an activity.
- Two users attempt to take the final available place simultaneously: only one confirmed
  participation is recorded and the other receives a full-activity message.
- An activity is edited after safety review: the changed content is reviewed again before
  publication remains active.
- A browser loses connectivity during creation, joining, or review: no duplicate mutation is
  created and the user can retry with an explicit status message.
- Private identity fields, API credentials, and safety-review input are not exposed in public
  activity cards, participant lists, or diagnostic logs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST list only activities in a recruiting state on the discovery view.
- **FR-002**: Each listed activity MUST expose its purpose, description, scheduled time, public
  meeting location, participant count, and participant limit.
- **FR-003**: The service MUST require authentication before a user can join or create an
  activity.
- **FR-004**: The service MUST use a nickname, optional character icon, and behavior-based
  trust indicator as the public identity; it MUST NOT display real name, email, gender, age,
  profile photo, or credential data to other participants.
- **FR-005**: An activity MUST require a purpose, description, scheduled time, public meeting
  location, and participant limit from three through six people.
- **FR-006**: The service MUST prevent one-to-one activities by cancelling any activity with
  fewer than three confirmed participants two hours before its scheduled start.
- **FR-007**: The service MUST prevent duplicate participation, participation in cancelled or
  full activities, and participant counts above the configured limit.
- **FR-008**: The service MUST screen activity content before publication for dating or gender-
  matching intent, harassment, scams, sales or investment promotion, and proselytizing.
- **FR-009**: Safety screening MUST account for common punctuation, spacing, and wording
  variations and MUST return a category and understandable revision guidance when held.
- **FR-010**: If safety screening is unavailable or uncertain, the service MUST fail closed by
  holding the activity and offering retry or manual review.
- **FR-011**: The service MUST provide public activity-level communication only; it MUST NOT
  provide participant-to-participant direct messages, profile-photo uploads, or gender filters.
- **FR-012**: The service MUST allow eligible participants to submit one behavior-based review
  after an activity ends and MUST exclude appearance, status, and romantic suitability from
  review dimensions.
- **FR-013**: Changes to activity content after review MUST trigger a new safety review before
  the activity remains published.
- **FR-014**: The service MUST provide explicit loading, empty, error, retry, cancellation, and
  held-for-review states for asynchronous activity and safety operations.

### Key Entities *(include if feature involves data)*

- **User**: Authenticated account with private identity fields, public nickname/icon, trust
  indicator, and participation eligibility state.
- **Activity**: Purpose-led neighborhood event with description, scheduled time, public place,
  participant limit, lifecycle state, creator, and safety-review state.
- **Participation**: Unique relationship between a user and activity with status and timestamps.
- **Safety Review**: Screening request and result with category, decision, explanation, and
  revision or appeal state.
- **Behavior Review**: One post-activity feedback record per eligible reviewer/participant pair,
  constrained to behavior dimensions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability review, at least 90% of first-time participants can find an activity
  and submit a participation request within three minutes without seeing private identity data.
- **SC-002**: Across two browser sessions, a successful join or cancellation is reflected in the
  other session’s participant state within 1 second in at least 95 of 100 trials.
- **SC-003**: In a labeled review set of 50 safe and unsafe activity submissions, at least 45
  unsafe submissions containing direct or obfuscated prohibited intent are held for review.
- **SC-004**: In 100 concurrent final-place join attempts, the persisted participant count never
  exceeds the configured limit and no user is confirmed twice.
- **SC-005**: In privacy review, zero discovery cards, participant lists, or public activity
  responses contain a user’s real name, email, gender, age, or authentication secret.
- **SC-006**: At least 95% of tested failure cases display a specific user-actionable state for
  retry, correction, cancellation, or manual review rather than silently failing.

## Assumptions

- The first release is a responsive web experience; mobile-native applications are out of
  scope.
- A protected server-side boundary will be introduced before production use of external AI
  credentials; the current browser demo may use a mock screening path only.
- Public meeting-place validation begins with a curated or reviewed place input rather than a
  fully automated maps search.
- Authentication and legal identity verification are represented by a development-safe flow in
  the initial prototype; production identity verification requires a separate compliance review.
- The exact trust-score formula and appeal workflow are implementation decisions, provided they
  preserve behavior-only evaluation and an auditable correction path.

## Course and Evaluation Alignment Addendum

This addendum keeps the original neighborhood-activity scope and adds only the work required
to demonstrate the course workflow and the supplied evaluation rubric.

### Additional User Story 5 - Receive a context-aware activity recommendation (Priority: P1)

As a resident with a specific comfort level, schedule, and activity interest, I can receive
small-group recommendations that explain why each activity fits me without exposing private
identity data or turning the service into person matching.

**Independent Test**: A user supplies an interest and comfort preference, receives at least one
matching recruiting activity with an understandable reason, and receives a useful empty or
clarifying state when no activity fits.

### Additional User Story 6 - Screen context and intent before publication (Priority: P1)

As a community operator, I can identify unsafe or off-purpose activity intent even when the
wording is indirect, euphemistic, spaced, punctuated, or otherwise obfuscated, while retaining
a correction and human-review path for uncertain cases.

**Independent Test**: A labeled fixture set containing direct, indirect, and obfuscated intent
is classified into approved, held, or manual-review outcomes; no uncertain submission is
silently published; the result includes category, confidence band, explanation, and next step.

### Additional User Story 7 - Operate and improve the AI workflow (Priority: P2)

As a project team, I can replay representative inputs through the same workflow, inspect
latency, outcome, and quality evidence, compare prompt versions, and detect regressions before
they affect users.

**Independent Test**: The local validation run executes a fixed dataset, records pass/fail
results and operational fields, and compares a baseline with a revised prompt or rule set.

### Additional Functional Requirements

- **FR-015**: The service MUST provide an activity recommendation based on explicit user
  preferences and retrieved recruiting-activity context, with a user-readable reason and no
  person-to-person matching signal. The protected recommendation path SHOULD use RAG over
  activity purpose, description, category, schedule, public location, capacity, and comfort
  metadata; the local prototype MUST label its deterministic grounded fallback.
- **FR-016**: The safety workflow MUST combine deterministic normalization/rules with semantic
  intent classification for dating, harassment, scams, sales, investment solicitation,
  proselytizing, and unrelated recruitment.
- **FR-017**: The safety workflow MUST return `approved`, `held`, `manual_review`, or
  `unavailable` with category, confidence band, explanation, and correction/review action.
- **FR-018**: The workflow MUST fail closed when validation, AI classification, persistence,
  or the automation endpoint is unavailable; it MUST expose retry or manual review.
- **FR-019**: The project MUST expose a reproducible automation contract that accepts an activity
  submission and returns a schema-validated decision suitable for n8n or a protected server.
- **FR-020**: The project MUST maintain representative recommendation and safety evaluation
  datasets, deterministic checks, and a repeatable before/after comparison.
- **FR-021**: Operational records MUST include outcome, category, latency, retry count, and
  quality score while excluding private identity and unnecessary raw sensitive content.
- **FR-022**: Prompts and decision policies MUST be versioned with a safe fallback and a way to
  compare or roll back a candidate version.

### Additional Success Criteria

- **SC-007**: In a representative recommendation set, at least 90% of responses contain a
  relevant activity and an explicit user-readable reason.
- **SC-008**: In a 50-case safety set containing direct and obfuscated intent, at least 45
  prohibited cases are held or routed to manual review, and no unavailable case is approved.
- **SC-009**: A reviewer can replay the complete automation path and identify the input,
  decision, failure path, and evidence within three minutes.
- **SC-010**: A candidate prompt or policy version cannot replace the baseline unless it passes
  the same evaluation set without degrading the safety gate or privacy checks.

### Additional Constraints

- n8n is the demonstrable orchestration layer for the core automation path; the browser may use
  a local fallback only for offline demonstration and must label it as such.
- Semantic detection is defense-in-depth, not an absolute guarantee. The system MUST measure
  false negatives and false positives and route uncertain content to human review.
- The implementation MUST stay within the evaluation scope: no unrelated product features or
  infrastructure may be added merely for technical novelty.
