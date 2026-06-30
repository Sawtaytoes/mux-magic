# 2026-05-17 — Remove HA-specific endpoint; keep generic outbound webhooks

- **Status:** Accepted
- **Date decided:** 2026-05-17
- **Area:** server/api
- **Source:** worker 67, commit `e4a14039` (PR #130)
- **Supersedes:** [2026-05-13-ha-inbound-trigger-endpoint](2026-05-13-ha-inbound-trigger-endpoint.md)

## Decision

mux-magic is a generic media processor and exposes **no consumer-specific inbound routes**. Worker 67 deleted `POST /jobs/named/sync-mux-magic`, the `X-HA-Token` middleware, and the `HA_TRIGGER_TOKEN` env var. Any orchestrator (Home Assistant, n8n, a shell script) triggers work by POSTing to the canonical `/sequences/run`. Access control, if needed, lives at the network edge (reverse proxy), deferred until a unified server-wide auth design exists.

The **outbound** webhook reporter (`WEBHOOK_JOB_*_URL`, `WEBHOOK_PROCESS_CRASHED_URL`) stays — those are generic outbound notifications, not HA-specific.

## What we rejected — DO NOT revert to this

- Do not re-add a named-consumer inbound endpoint (anything like `/jobs/named/sync-<consumer>`), and do not re-introduce `X-HA-Token` / `HA_TRIGGER_TOKEN` or any per-consumer token scheme. That was [the prior decision](2026-05-13-ha-inbound-trigger-endpoint.md) and it was reversed on purpose.
- Do not delete the outbound webhook reporter while "cleaning up HA stuff." Inbound (removed) and outbound (kept) are different concerns.

## Why it must not be re-litigated

Encoding one orchestrator's identity into the API surface leaks integration concerns into a generic tool and the token didn't generalize. The user wants mux-magic consumer-agnostic. The historical worker docs (1c, 1e) are intentionally left untouched per "never rewrite history" — this decision file is the forward-looking record.
