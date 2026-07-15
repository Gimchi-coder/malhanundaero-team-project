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

### Protected Censorship_Agent gateway evidence

Run the gateway from `/Users/cw/Downloads/Censorship_Agent` with `MODERATION_USE_AI=0` for
deterministic contract replay, or set `MODERATION_USE_AI=1` and provide `OPENAI_API_KEY` only in
the server environment for semantic classification. The observed local responses were:

| Input | Expected | Observed |
|---|---|---|
| 공개 장소 독서 모임 | `approved` | `approved` |
| `ㄷㅂ사주실분` 우회 표현 | `held` + danger category | `held` + `danger_or_illegal_activity` |
| AI 인증 실패 | never approved | `manual_review` |

The gateway maps `allow → approved`, `revise/block → held`, and `review → manual_review`.
It does not permanently delete content; an already published item requires an explicit operator
approval step.

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

## Activity history

- 정상: 로그인한 사용자가 활동 A에 참여하고 모임 B를 만든 뒤 마이페이지에서 `내가 신청한 활동`과 `내가 만든 모임`에 각각 분리되어 표시되는지 확인한다.
- 영속성: 로그아웃 후 같은 계정으로 다시 로그인해도 두 기록이 유지되는지 확인한다.
- 예외: 활동 A의 `참여 취소`를 누른 뒤 신청 목록에서 A가 제거되고, 만든 모임 B의 기록에는 영향을 주지 않는지 확인한다.

## Evidence

Record browser/version, timestamps, and deviations from the scenarios here before production
integration.
