# Client State Contract

The browser client consumes public projections and never receives private identity fields or
provider secrets.

## Activity card

Required fields: `id`, `title`, `purpose`, `description`, `location`, `scheduledAt`, `status`,
`participantCount`, and `participantLimit`.

Allowed status values: `pending`, `recruiting`, `confirmed`, `cancelled`, `completed`.

## User projection

Required fields: `id`, `nickname`, `icon`, and `trustScore`. Real name, email, gender, age,
identity-verification data, and credentials are prohibited.

## UI operation states

Every asynchronous operation exposes `idle`, `loading`, `success`, and `error` state. Activity
creation additionally exposes `held` with `category`, `explanation`, and `guidance`; joining
additionally exposes `full`, `duplicate`, and `cancelled` outcomes.
