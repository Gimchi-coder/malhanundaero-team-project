# 동네 광장 Validation

## Automated checks

- `node --check main.js`: PASS
- `node --check config.js`: PASS
- `safety-review-fixtures.json`: 50 cases
- `node tests/evaluate.mjs`: recommendation and safety evaluation with policy version
- `guardrail-fixtures.json`: prompt-injection and PII handling cases
- `n8n/workflows/activity-safety-and-recommendation.json`: importable workflow artifact
- Browser-delivered OpenAI credentials/provider references: PASS (none found)

## Activity journey

1. Start `python3 -m http.server 8000` and open two independent browser sessions.
2. Click 로그인 and start with a nickname; confirm no real name, email, phone, gender, age, or
   password is requested or rendered.
3. Confirm only recruiting activities show purpose, public location, time, count, and limit.
4. Log in with distinct nicknames in both sessions.
5. Join from session A and confirm session B receives the storage-event update.
6. Attempt to join the same activity twice; confirm the count does not increase twice.
7. Fill an activity to capacity and confirm another join receives an actionable full state.
8. Clear stored groups and reload; confirm the empty state is explicit.

## Creation and privacy

1. Inspect discovery cards, participant projections, and the profile bar. No real name, email,
   gender, age, or secret may be rendered.
2. Submit missing fields, a past time, limits outside 3–6, and a private location such as
   “우리 집”; each must remain unpublished with an actionable message.
3. Search browser source and network requests for `OPENAI_API_KEY`, `api.openai.com`, and bearer
   credentials. All must be absent.

## Safety review

Run `safety-review-fixtures.json` against the deterministic adapter. Safe cases must be approved;
unsafe direct or obfuscated cases must be held with category-specific guidance. If
`SAFETY_REVIEW_URL` is configured and unavailable, the activity must remain held with retry or
manual-review guidance.

The layered local policy includes normalization, direct/obfuscated intent rules, ambiguous
context routing, confidence bands, and a protected endpoint adapter. The local fallback is
explicitly labeled as offline policy behavior; it is not presented as a provider-backed AI
decision.

Input guardrails reject system-rule override requests before an AI call and mask email/phone
patterns before operational records are written.

## Recommendation and rubric evidence

1. Enter an interest and comfort preference in the recommendation panel.
2. Confirm the result includes a fit score, activity context, and a user-readable reason.
3. Use an unmatched interest to verify the clarifying empty state.
4. Import and replay the n8n workflow using the automation contract.
5. Record policy version, total cases, pass rate, unsafe routed count, latency, and any false
   positive/negative for review.

## Behavior review

- Only punctuality, courtesy, and rule adherence may be review dimensions.
- A participant cannot review themselves or submit a duplicate review for the same activity.
- Appearance, credentials, gender, and romantic suitability must not be represented.
- Trust changes must be exposed only through the public trust projection.

## Evidence

Record browser/version, timestamps, and deviations from the scenarios here before production
integration.
