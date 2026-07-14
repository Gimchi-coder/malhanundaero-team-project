# Automation Contract: Activity Safety and Recommendation

## Purpose

This contract is the stable boundary between the browser, n8n, and a protected semantic AI
provider. The browser must not depend on provider-specific response fields.

## Input

```json
{
  "operation": "safety_review | recommend",
  "requestId": "string",
  "activity": {
    "title": "string",
    "purpose": "string",
    "description": "string",
    "location": "public place string",
    "scheduledAt": "ISO-8601 string",
    "maxParticipants": 3
  },
  "preferences": {
    "interest": "string",
    "comfort": "quiet | light_conversation | active | any",
    "timeWindow": "today | this_week | any"
  }
}
```

The request must not contain real names, email addresses, authentication secrets, or raw
private profile fields.

## Safety response

```json
{
  "requestId": "string",
  "decision": "approved | held | manual_review | unavailable",
  "categories": ["dating", "harassment", "scam", "sales", "investment", "proselytizing", "recruitment"],
  "confidence": "high | medium | low",
  "explanation": "short user-readable explanation",
  "guidance": "correction, retry, or operator-review action",
  "policyVersion": "safety-v1",
  "latencyMs": 0,
  "retryCount": 0
}
```

Missing, malformed, conflicting, low-confidence, or unavailable results are never approved.
`held` is used when a prohibited intent is sufficiently supported. `manual_review` is used
when context is ambiguous or the provider fails safely.

## Recommendation response

```json
{
  "requestId": "string",
  "recommendations": [
    {
      "activityId": "string",
      "reason": "string",
      "fit": 0.0,
      "policyVersion": "recommendation-v1"
    }
  ],
  "message": "empty or clarifying message",
  "latencyMs": 0,
  "retryCount": 0
}
```

## Failure behavior

HTTP failures, timeouts, invalid JSON, and schema mismatches produce `unavailable` for safety
or an empty recommendation with a retry message. The browser may use its labeled offline
fallback only when the endpoint is not configured; it must never represent that fallback as a
provider-backed decision.
