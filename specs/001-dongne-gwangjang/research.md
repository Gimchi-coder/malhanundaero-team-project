# Research: 동네 광장 안전한 동네 모임

## Decision: Keep a browser-safe adapter boundary

**Rationale**: The current prototype can work with deterministic mock data, but real database
mutations and safety review need a stable boundary. `main.js` will call adapters rather than
embedding provider-specific behavior in UI handlers. This supports local demo mode and a later
managed backend without changing user journeys.

**Alternatives considered**: A direct browser call to the AI provider was rejected because it
would expose credentials and violate the project constitution. A full client framework was
deferred because the current scope is small and the existing vanilla surface is sufficient.

## Decision: Fail closed for safety review

**Rationale**: If the safety dependency is unavailable or uncertain, an activity must remain
held rather than being silently published. The result includes a category, explanation, and
revision guidance, with a retry/manual-review path.

**Alternatives considered**: Automatically publishing when review fails was rejected because it
breaks the product’s safety promise. Permanent rejection without correction guidance was
rejected because it increases false-positive harm and reduces inclusion.

## Decision: Enforce participation invariants in the data boundary

**Rationale**: A unique user/activity participation relation and an atomic capacity check are
needed to prevent duplicate joins and over-capacity under concurrent requests. The scheduled
cancellation check is a backend responsibility, with client updates delivered through realtime
events.

**Alternatives considered**: Client-only count checks were rejected because two clients can make
the same decision from stale state. A periodic browser timer alone was rejected because it does
not run reliably when all browsers are closed.

## Decision: Separate private identity from public participation data

**Rationale**: Authentication and any development identity-verification data stay in protected
records. Public activity and participant responses expose only nickname, icon, and behavior trust
projection. This makes the privacy boundary explicit and reviewable.

**Alternatives considered**: Storing all user fields in a public profile object was rejected
because it invites accidental rendering and over-collection.

## Course-aligned decisions

### Decision: n8n as the demonstrable orchestration boundary

**Rationale**: The evaluation rubric explicitly asks whether n8n workflow logic is the core
logic. A portable workflow JSON with webhook, validation, normalization, semantic review, and
explicit branches provides inspectable evidence without coupling the browser to a provider.

**Alternatives considered**: Browser-only calls were rejected because they expose credentials
and make retries, auditability, and replay difficult. A large backend was rejected because it
would exceed the current evaluation scope.

### Decision: layered semantic safety review

**Rationale**: Keyword rules are fast and deterministic but miss euphemisms and context. A
semantic classifier catches intent; conservative confidence handling and human review reduce
the risk of an opaque automated harmful outcome.

**Alternatives considered**: Keyword-only filtering was rejected for the stated evasion use
case. Unreviewable AI auto-blocking was rejected by the constitution's human-dignity and
safety principles.

### Decision: local fallback plus protected endpoint

**Rationale**: The static demo must remain runnable without installed services, while the
production-shaped path must keep credentials outside browser code. The same JSON contract makes
both paths testable.

### Decision: dataset-first evaluation

**Rationale**: The course teaches golden datasets, deterministic evaluators, LLM-as-judge, and
regression checks. Recommendation and safety fixtures are therefore versioned alongside the
implementation and compared before promotion.
