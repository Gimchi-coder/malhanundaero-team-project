# Quickstart Validation: 동네 광장

## Prerequisites

- A modern browser.
- The repository checked out locally.
- For local demo mode, leave provider placeholders in `config.js`.
- For persistent mode, configure public Supabase settings and route AI screening through the
  protected server boundary described in the plan.
- To exercise the real semantic safety agent, run
  `/Users/cw/Downloads/Censorship_Agent/scripts/run_server.py` with provider credentials in
  environment variables, then point n8n's `SAFETY_CLASSIFIER_URL` at its `/moderate` endpoint.

## Run

Serve the repository root with `python3 -m http.server 8000` and open `http://localhost:8000`.
Do not expose a real
AI secret in `config.js` or browser source.

## Validation scenarios

1. Open the discovery view and confirm recruiting activities show purpose, public place, time,
   and participant count; verify no private identity fields are visible.
2. Sign in with a development-safe identity, create a safe activity, and confirm its loading
   then recruiting state.
3. Create text containing dating, sales, investment, or proselytizing intent and confirm the
   activity remains held with a category and correction guidance.
4. With the protected gateway enabled, submit a safe activity and an obfuscated-risk activity
   such as `ㄷㅂ사주실분`; confirm that only the safe activity can become `recruiting`.
5. Join an activity from two independent browser sessions and confirm the count never exceeds
   the limit and both views receive the update within the stated target.
6. Exercise an activity with fewer than three confirmed participants at the cancellation
   threshold and confirm the state and participant warning.
7. After completion, confirm behavior-only feedback dimensions and one-review-per-participant
   rules.

## Evidence to record

- Browser/session identifiers and timestamps for realtime scenarios.
- Safety review fixture, expected category, actual decision, and guidance.
- Privacy inspection showing public responses contain only permitted user projection fields.

## Course and rubric validation

### Static and fixture checks

```bash
node --check main.js
node --check config.js
node tests/evaluate.mjs
node -e "JSON.parse(require('fs').readFileSync('n8n/workflows/activity-safety-and-recommendation.json','utf8')); console.log('n8n workflow JSON: PASS')"
git diff --check
```

Expected evidence: the 50-case safety set reports at least 45 unsafe cases as `held` or
`manual_review`, no unavailable response is approved, and the workflow file parses as JSON.

### Recommendation journey

1. Enter `산책`, choose `함께 움직이는 활동`, and request a recommendation.
2. Confirm the card contains a fit percentage, activity, location/time, and a plain-language
   reason; confirm no participant private identity is shown.
3. Enter an unmatched interest and confirm the clarifying empty state.

### n8n replay

1. Import `n8n/workflows/activity-safety-and-recommendation.json` into n8n.
2. Configure the protected classifier URL through the n8n environment, not browser source.
3. POST the contract-shaped sample from `contracts/automation.md` to the test webhook.
4. Replay a safe, direct prohibited, obfuscated, and classifier-failure input. Record the
   response decision, category, confidence, and failure path.

### Code replacement replay

1. Deploy the repository to Vercel so api/automation.js is exposed as a serverless endpoint.
2. Add OPENAI_API_KEY to Vercel server environment variables. Never add it to config.js.
3. Set AUTOMATION_MODE to code in config.js and redeploy.
4. Replay the same safety_review and recommend JSON bodies against /api/automation.
5. Confirm recommendation responses report embedding-cosine or semantic-vector-cosine retrieval
   and safety failures return unavailable or manual_review without publishing.

The code path is an MVP in-memory vector retrieval implementation. Supabase pgvector is the
next persistence step if the activity knowledge base grows; it is not required to demonstrate
the current RAG structure.

### Rubric evidence map

| Rubric | Evidence |
|---|---|
| 문제 정의·독창성 | `team_prd.md`, hero copy, browse-to-join journey |
| n8n 자동화 | imported workflow, webhook replay, explicit decision branch |
| 기술적 완성도·안정성 | schema contract, fixture score, retry/manual-review/fail-closed states |
| 확장성·재사용성 | contracts, policy versions, adapter boundary, fixture runner |
| 발표·협업 | this quickstart, 3-minute replay order, recorded evidence |
