# Data Model: 동네 광장 안전한 동네 모임

## User

| Field | Description | Rules |
|---|---|---|
| id | Authenticated account identifier | Unique; never displayed publicly |
| private_identity | Protected verification fields | Restricted access; not in public projections |
| nickname | Public display name | Required, unique within the service |
| icon | Public character/icon choice | No uploaded photos |
| trust_score | Behavior-based public trust projection | Starts at 50; positive behavior +1, improvement-needed behavior -2; clamped to 0–100 |
| eligibility_state | Whether joining/creating is allowed | Restricted users cannot mutate activities |

## Activity

| Field | Description | Rules |
|---|---|---|
| id | Activity identifier | Unique |
| creator_id | User who created the activity | References User; private in public responses |
| title, purpose, description | Activity content | Required; reviewed before publication |
| location | Public meeting place | Required; private addresses are invalid |
| scheduled_at | Start time | Must be in the future at creation |
| participant_limit | Maximum participants | Integer from 3 through 6 |
| status | `pending`, `recruiting`, `confirmed`, `cancelled`, `completed` | Controlled transitions only |
| review_state | Safety decision and revision state | Must pass before recruiting |
| created_at, updated_at | Audit timestamps | Server generated |

## Participation

| Field | Description | Rules |
|---|---|---|
| activity_id | Activity reference | Composite key component |
| user_id | User reference | Composite key component |
| status | `confirmed`, `withdrawn`, `cancelled` | One active participation per user/activity |
| joined_at | Confirmation timestamp | Server generated |

The `(activity_id, user_id)` pair is unique. Confirming a participation must atomically verify
that the activity is recruiting and has capacity.

## Safety Review

## Course-aligned entities

### Recommendation Request

- `request_id`: unique request identifier
- `interest`: user-provided activity interest
- `comfort`: bounded comfort preference
- `time_window`: bounded schedule preference
- `created_at`: timestamp

### Recommendation

- `request_id`, `activity_id`: relationship keys
- `reason`: user-readable fit explanation
- `fit`: normalized score from 0 to 1
- `policy_version`: versioned recommendation policy

### Safety Review Decision

- `request_id`, `activity_id`: relationship keys
- `decision`: `approved`, `held`, `manual_review`, or `unavailable`
- `categories`: policy categories detected
- `confidence`: `high`, `medium`, or `low`
- `explanation`, `guidance`: safe user-facing fields
- `policy_version`, `created_at`: reproducibility metadata

State transition: `submitted → validating → semantic_review → approved|held|manual_review|unavailable`.
Only `approved` may publish an activity. `unavailable` and `manual_review` fail closed.

### Operation Log

- `request_id`, `operation`: correlation fields
- `outcome`, `category`: aggregate result
- `latency_ms`, `retry_count`: operational metrics
- `quality_score`: optional evaluation score
- `policy_version`, `created_at`: experiment metadata

Operation logs exclude raw private identity, secrets, and unnecessary user text.

### Prompt Policy

- `name`: stable policy identifier
- `version`: immutable candidate version
- `label`: `baseline`, `candidate`, or `production`
- `fallback_version`: safe fallback
- `created_at`: audit timestamp

Promotion requires the candidate to pass the same safety, privacy, and recommendation fixture
set as the baseline.

| Field | Description | Rules |
|---|---|---|
| id | Review identifier | Unique |
| activity_id | Activity under review | References Activity |
| decision | `approved`, `held`, `manual_review`, `unavailable` | Only approved may publish |
| categories | Detected risk categories | Dating, harassment, scam, sales, investment, proselytizing |
| explanation | User-facing reason | Must be understandable and non-sensitive |
| guidance | Correction or retry guidance | Required for held decisions |
| input_fingerprint | Non-reversible audit reference | Never store unnecessary raw sensitive text |

## Behavior Review

| Field | Description | Rules |
|---|---|---|
| id | Review identifier | Unique |
| activity_id | Completed activity | References Activity |
| reviewer_id, subject_id | Participant references | Both must have participated; no self-review |
| dimensions | Behavior-only ratings | Punctuality, courtesy, rule adherence |
| created_at | Submission timestamp | One review per reviewer/subject/activity |

## State transitions

```text
pending --approved--> recruiting --capacity/time rule--> confirmed
pending --held/manual_review--> pending
recruiting --<3 confirmed at T-2h--> cancelled
recruiting --start reached with >=3--> confirmed
confirmed --scheduled time passed--> completed
```
