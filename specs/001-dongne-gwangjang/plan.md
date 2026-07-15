# Implementation Plan: 동네 광장 안전한 동네 모임

**Branch**: `001-dongne-gwangjang` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dongne-gwangjang/spec.md`

## Summary

Deliver the first usable “동네 광장” journey: authenticated users discover and join
purpose-led neighborhood activities, create activities that pass a safety gate, and see
participant state update consistently. The current static frontend is the prototype shell;
the plan adds a clear boundary for authentication, activity state, safety review, and
concurrency-safe participation while preserving a browser-safe mock mode.

## Technical Context

**Language/Version**: Modern JavaScript (ES2022+) with HTML5 and CSS3

**Primary Dependencies**: Supabase Auth, Database, and Realtime; protected server-side AI
screening endpoint; no UI framework

**Storage**: Relational records for users, activities, participations, safety reviews, and
behavior reviews; private identity fields separated from public profile projection

**Testing**: Browser-level journey checks, deterministic unit tests for state transitions and
screening normalization, concurrency/integration checks for participation limits, and a 50-case
safety review set

**Target Platform**: Responsive modern browsers; server-side boundary for protected credentials

**Project Type**: Web application with a browser client and managed backend services

**Performance Goals**: Participant and cancellation state visible to other active sessions within
1 second for at least 95% of 100 trials; primary discovery-to-join journey completable within
3 minutes by at least 90% of first-time users

**Constraints**: No profile photos, public gender filters, romantic matching, or participant DMs;
activity limits are 3–6; public meeting places are required; safety review fails closed;
production AI credentials must never be delivered to the browser

**Scale/Scope**: Prototype and first release for neighborhood activities, with at least 100
concurrent final-place join attempts used for correctness validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Inclusive participation: PASS — household composition is not an eligibility gate.
- Group activity over matching: PASS — the design has activity-led discovery and no 1:1 matching.
- Safety and trust: PASS — public places, 3-person minimum, screening, reporting/review paths,
  and fail-closed behavior are specified.
- Privacy: PASS — public identity is a nickname/trust projection and protected credentials are
  server-side; private identity data is separated from public responses.
- Evidence-based delivery: PASS — user stories, acceptance scenarios, measurable outcomes,
  edge cases, and repeatable verification are defined.

## Project Structure

### Documentation (this feature)

```text
specs/001-dongne-gwangjang/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── client-state.md
│   └── safety-review.md
└── tasks.md
```

### Source Code (repository root)

```text
index.html              # Discovery, authentication, creation, and feedback surfaces
style.css               # Responsive visual system and interaction states
main.js                 # Client state, activity flows, and adapters
config.js               # Non-secret public configuration only
server/                 # Protected AI boundary and scheduled activity jobs (planned)
tests/                  # Unit, integration, and browser journey verification (planned)
```

**Structure Decision**: Keep the existing simple browser surface while introducing explicit
client adapters and a protected server boundary as soon as real credentials or persistent
mutations are enabled. The mock adapter remains available for local UI work and deterministic
review-set tests.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Protected server boundary | Prevents AI credentials from reaching browsers | Direct browser-to-provider calls violate the constitution’s secret-handling rule |
| Scheduled cancellation check | Enforces the 3-person safety invariant even when no browser is open | Client-only timers can be skipped, duplicated, or manipulated |

## Course-Aligned Delivery Plan

The implementation will demonstrate the smallest complete loop required by the course and
rubric: browser input → n8n-compatible automation contract → AI-assisted decision → persisted
result → observable validation evidence.

### Automation boundary

`n8n/workflows/activity-safety-and-recommendation.json` is the portable workflow artifact. It
uses a webhook-shaped input, schema validation, normalization, a semantic-review boundary,
explicit decision branches, and a response contract. `config.js` contains only public endpoint
configuration. The browser uses a deterministic local fallback when no protected webhook is
configured; it never contains a provider secret.

### AI safety design

The code-first replacement lives in api/automation.js. Its recommendation branch performs
embedding-based top-k retrieval before generation, while its safety branch performs deterministic
gating before context classification. AUTOMATION_MODE selects n8n or the code endpoint without
changing the browser contract. The current vector store is in-memory for MVP scope; Supabase
pgvector is the scalable persistence option.

The client-side fallback is intentionally conservative and deterministic for offline testing.
The protected automation path may call an AI classifier that returns structured intent labels,
confidence bands, and explanations. The client treats unavailable, malformed, low-confidence,
or conflicting results as `manual_review` and never publishes them automatically.

### Evaluation and observability

The project keeps recommendation fixtures, safety fixtures, schema checks, and a small local
evaluation runner in `tests/`. Each run records only aggregate outcome, latency, category,
retry count, and score. Prompt/policy versions are named so a baseline and candidate can be
compared without changing the application contract.

### Rubric evidence

- Problem: `team_prd.md`, hero copy, and the primary browse-to-join journey.
- n8n design: workflow JSON, contract, and quickstart replay steps.
- Stability: validation states, fail-closed behavior, schema checks, and retry path.
- Reuse: contracts, versioned policy configuration, and isolated adapter functions.
- Presentation: quickstart demo script and recorded validation evidence.
