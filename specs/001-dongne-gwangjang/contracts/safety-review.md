# Safety Review Contract

## Request

```json
{
  "title": "string",
  "purpose": "string",
  "description": "string",
  "location": "string"
}
```

The request is sent only through the protected server boundary in production. The client may
use a deterministic mock adapter for local development.

The protected boundary may be the Censorship_Agent gateway at
`/Users/cw/Downloads/Censorship_Agent/scripts/run_server.py`. It accepts the app's
`safety_review` envelope, performs normalization and hybrid semantic review, and returns this
contract without exposing the provider key to the browser.

## Response

```json
{
  "decision": "approved | held | manual_review | unavailable",
  "categories": ["dating | harassment | scam | sales | investment | proselytizing"],
  "explanation": "string",
  "guidance": "string",
  "reviewId": "string"
}
```

Only `approved` may transition an activity to `recruiting`. `held`, `manual_review`, and
`unavailable` must not publish the activity.
