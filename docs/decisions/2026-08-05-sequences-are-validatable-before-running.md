# 2026-08-05 — A sequence can be validated before it runs

- **Status:** Accepted
- **Date decided:** 2026-08-05
- **Area:** server/api
- **Source:** chat session (movie-ingest runbook; owner: "we should have some sort of JSON Schema you could use to verify it locally before giving it to me… add a verification URL to mux-magic if it doesn't already have it")

## Decision

`POST /sequences/validate` checks a sequence document **without starting a job
or touching any files** and always responds `200 { isValid, errors[] }`. It runs
two layers: the envelope schema (`validatedParsedSequenceSchema` — YAML parses,
unique step ids, no `linkedTo` between parallel-group siblings, known commands,
`@ref` format) **and** the per-step param check the runner does at execution
time (`resolveSequenceParams` for `@pathId` + `{ linkedTo, output: 'folder' }`,
then `config.schema.safeParse`). The offline equivalent is `GET /openapi.json`
(OpenAPI 3.1 = JSON Schema 2020-12), which carries the sequence envelope
schemas and every command's request schema.

## What we rejected — DO NOT revert to this

- Treating a malformed sequence as a **request error** (`400`) on the validate
  path. Validation must return `200` with `isValid: false` + structured
  `errors` so a caller always parses one response shape; the request body
  schema is intentionally permissive (`z.record`) so the handler — not the
  router boundary — reports what's wrong.
- Duplicating the runner's validation logic in a second place. The validate
  endpoint reuses the **same** envelope schema and the **same**
  `resolveSequenceParams` + `config.schema` check the runner applies per step,
  so "valid here" means "won't be rejected there."

## Why it must not be re-litigated

Hand-written and agent-generated sequences were previously only checkable by
running them (side effects) or eyeballing YAML. A pre-run validator lets a
sequence be verified before it touches the filesystem, which is the safety the
owner asked for. If the sequence shape or per-command schemas change, the
validator inherits it automatically because it imports the same schemas — keep
it that way rather than forking a parallel copy.
