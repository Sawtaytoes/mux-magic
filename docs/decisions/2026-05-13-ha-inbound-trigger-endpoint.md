# 2026-05-13 — Home Assistant inbound trigger endpoint

> [!WARNING]
> **SUPERSEDED on 2026-05-17 by [Remove HA-specific endpoint; keep generic outbound webhooks](2026-05-17-remove-ha-specific-endpoint.md).**
> This used to be the decision. It is kept for history — do NOT implement what's
> below. The current rule: mux-magic exposes NO consumer-specific inbound routes;
> any orchestrator POSTs to the generic `/sequences/run`, and the **outbound**
> webhook reporter is the only HA-adjacent surface that survives.

- **Status:** Superseded by [2026-05-17-remove-ha-specific-endpoint](2026-05-17-remove-ha-specific-endpoint.md)
- **Date decided:** 2026-05-13
- **Area:** server/api
- **Source:** worker 1e, commit `2691aef6` (PR #99)

## Decision

Worker 1e added a Home-Assistant-facing inbound trigger: `POST /jobs/named/sync-mux-magic`, guarded by an `X-HA-Token` middleware reading a `HA_TRIGGER_TOKEN` env var, so HA could kick off a named job directly. It also added the outbound webhook reporter (`WEBHOOK_JOB_*_URL`).

## What we rejected — DO NOT revert to this

At the time we accepted baking a specific consumer's name ("HA" / "sync-mux-magic") and a bespoke token scheme into the API surface. Four days later this was judged wrong (see the superseding decision): naming one orchestrator in the route leaked integration concerns into a generic media-processing API, and the token middleware didn't generalize.

## Why it must not be re-litigated

Kept only as the historical "before" of the supersession. Do not re-add named-consumer endpoints or per-consumer tokens. Note that the **outbound** webhook reporter introduced in the same worker was deliberately *kept* — don't delete it as "also HA-specific."
