# Home Assistant integration — error/failure reporting from media-tools and media-sync

Audience: media-tools and media-sync. Applies equally to both apps; this
document lives in media-tools as the single source of truth and is referenced
from the media-sync docs.

---

## 1. Goal restatement

The user wants Home Assistant to know when something has gone wrong in
media-tools or media-sync — a job that failed, a sync run that encountered
errors, a Docker image that has gone stale, or a server that has gone
completely silent. From there HA acts as the notification bus: push
notifications via the HA Companion app, a flashing light, a persistent
dashboard badge, or an automation that pages on repeated failure. The signals
worth capturing are: individual job failures (which job, what error), sync-run
summaries (failed / changed / no-change counts), server online/offline
transitions, and build version (git SHA + build time, to detect stale images
without opening a browser). The question is which transport mechanism to use
to get those signals from two separately-deployed Node.js services into HA
reliably, with minimal operational overhead.

---

## 2. Options

| # | Name | How it works | HA side | App side | Latency | State after HA restart | Error model | Complexity |
|---|------|-------------|---------|----------|---------|----------------------|------------|------------|
| A | **MQTT + Mosquitto add-on** | Apps connect to an MQTT broker (Mosquitto) that HA runs as a native add-on. Apps publish to structured topics; HA subscribes. MQTT discovery payloads auto-create HA entities. | Install Mosquitto add-on; enable MQTT integration; no `configuration.yaml` edits needed for discovered sensors. | `mqtt` npm package; one persistent client per process; publishes on job events. | Near-real-time (~50 ms). | Retained messages survive broker restart; HA re-reads them on reconnect. | Broker queues messages if HA is momentarily down (QoS 1); retained "last-known" state always present. | Medium — broker credential management, topic design, one module per app. |
| B | **App pushes to HA REST `/api/states/`** | On failure, apps POST to `http://homeassistant.local:8123/api/states/<entity_id>` with a Long-Lived Access Token. HA creates or updates the entity. | Generate a long-lived access token in HA profile. No add-on. | Plain `fetch()` POST; no npm dep. | Near-real-time. | Entity state lost on HA restart (persisted to `.storage` but stale once history diverges). | Fire-and-forget — if HA is down the POST fails silently unless the app adds a retry queue. | Low for the happy path; higher if retry logic is added. |
| C | **App pushes to HA webhook `/api/webhook/<id>`** | Simpler variant of B. User creates a webhook automation in HA UI; apps POST to `/api/webhook/<id>` (no token needed). HA fires the automation immediately. | Create a webhook trigger automation in HA UI. | Plain `fetch()` POST; no npm dep. | Near-real-time. | Webhook automations survive restarts, but no sensor state is maintained — only the last-fired event matters. | Same fire-and-forget risk as B. | Lowest of all options. Good for alerting, bad for dashboards. |
| D | **HA polls apps (RESTful sensor)** | HA's built-in `rest` / `rest_sensor` integration polls a URL on a schedule (e.g., every 30 s). Apps expose a `/health` or `/status` endpoint that returns job counts, last-failure info, and version. | Add `rest_sensor` entries to `configuration.yaml` or use UI integration. | Add a `/health` route to each app's server. | Up to poll interval (30–60 s typical). | HA re-polls on restart; state is fresh within one poll cycle. | If an app is down the sensor goes "unavailable" automatically after the next failed poll. | Low on the app side (one route); medium on the HA side (YAML config or UI). |
| E | **SSE push via HA "Push" / RESTful push** | Apps stream Server-Sent Events; a custom HA integration or `rest_command` + automation could consume them. Less common pattern. | Custom HA integration or third-party component needed. | Expose an SSE endpoint (already done for `/jobs/stream`). | Real-time. | SSE connection drops on HA restart; reconnection depends on HA component. | Fragile — HA's built-in integrations do not natively consume SSE from external sources. | High — requires custom HA code. |

---

## 3. Topology recommendation

Each app should have **its own MQTT client** connecting to the **same shared
Mosquitto broker**. They are independently deployed Docker containers with
separate lifecycles; a shared client would couple their startup/crash behavior.

Topic prefixes follow the HA MQTT discovery convention:

```
homeassistant/sensor/media_tools/<sensor_id>/config     # discovery payload
homeassistant/sensor/media_tools/<sensor_id>/state      # current value
homeassistant/sensor/media_tools/<sensor_id>/attributes # JSON attributes

homeassistant/sensor/media_sync/<sensor_id>/config
homeassistant/sensor/media_sync/<sensor_id>/state
homeassistant/sensor/media_sync/<sensor_id>/attributes
```

Availability topics (so HA shows "Unavailable" when a service crashes):

```
media_tools/availability   # app publishes "online" on connect, LWT is "offline"
media_sync/availability    # same
```

Each discovery payload references its `availability_topic` so all sensors for
that app flip to Unavailable together when the process dies.

---

## 4. Recommendation

**Use MQTT with auto-discovery (Option A).**

MQTT is the canonical HA integration transport. The Mosquitto add-on is a
one-click install in HA. Once the broker is up, MQTT discovery means no manual
`configuration.yaml` edits — apps publish a JSON config payload once and HA
creates the entity automatically. Retained messages give HA a "last known
state" that survives both HA and app restarts; the availability topic makes HA
show "Unavailable" when a service crashes rather than silently showing stale
data. QoS 1 delivery means the broker queues messages when HA is momentarily
down and delivers them when it reconnects — something webhooks cannot do.
Webhooks (Option C) are fine for one-shot alerts but lose all state on HA
restart and have no reconnect semantics. Polling (Option D) works but is lazy
by 30–60 s and adds a `/health` route to maintain.

**npm package:** use [`mqtt`](https://www.npmjs.com/package/mqtt) — the one
the user linked. It is the most maintained MQTT client for Node.js, supports
MQTT v3.1.1 and v5, has clean async/await APIs, and handles reconnection with
configurable backoff out of the box. [`async-mqtt`](https://www.npmjs.com/package/async-mqtt)
is a thin promise wrapper around the same library; it adds nothing that the
modern `mqtt` v5 API does not already expose, so `mqtt` directly is preferred.

**Architecture inside each app:** introduce a thin `mqttReporter` module that
imports the `mqtt` client, connects once at server startup, and subscribes to
internal events (job completion, sequence completion, sync run end). It does
not sit in the hot path of any command execution — it listens to the same
events that `jobStore` / `sequenceRunner` already emit and translates them into
MQTT publishes. This keeps the MQTT dependency isolated: if the broker is
unreachable the reporter logs a warning and the app runs normally.

**Discovery + retained + availability in one registration call:**

```js
// Pseudocode — not a source file change
client.publish(
  'homeassistant/sensor/media_tools/last_failed_job/config',
  JSON.stringify({
    name: 'Media Tools — Last Failed Job',
    unique_id: 'media_tools_last_failed_job',
    state_topic: 'homeassistant/sensor/media_tools/last_failed_job/state',
    json_attributes_topic: 'homeassistant/sensor/media_tools/last_failed_job/attributes',
    availability_topic: 'media_tools/availability',
    icon: 'mdi:alert-circle',
  }),
  { retain: true },
)
```

Publishing the config payload with `retain: true` means HA picks it up
immediately on any restart without the app needing to republish.

---

## 5. Proposed signals to publish

| Signal | Topic (state) | Value | Attributes | Retain? |
|--------|--------------|-------|-----------|---------|
| Last failed job | `.../last_failed_job/state` | `"none"` or job name | `jobId`, `errorMessage`, `failedAt`, link to logs | Yes — sticky until next run clears it |
| Job failure count (session) | `.../job_failure_count/state` | integer | — | No |
| Sync run summary | `.../sync_last_run/state` | `"ok"` / `"partial"` / `"failed"` | `failed`, `changed`, `noChange`, `duration`, `finishedAt` | Yes |
| Server availability | `media_tools/availability` | `"online"` / `"offline"` | — | Yes (LWT) |
| Build version | `.../build_version/state` | git SHA (short) | `buildTime`, `version` (semver), `gitSha` (full) | Yes — set at boot |

The build version mirrors what `/version` already exposes; publishing it to
MQTT lets HA create a sensor and alert when the deployed SHA does not match
the latest `master` (a future automation, not this implementation).

---

## 6. Implementation footprint (for W24b / W24c)

### media-tools

- New file: `src/api/mqttReporter.ts`
  - Connects to broker at startup using `HASS_MQTT_BROKER_URL` env var.
  - Publishes discovery payloads and `online` availability on connect.
  - Registers Last Will and Testament (`offline`) before connecting.
  - Subscribes to `jobStore` completion/failure events (the same event bus
    that `jobRunner.ts` emits on) — no change to the hot path.
- `src/api-server.ts`: call `mqttReporter.connect()` after `jobStore` is
  initialized; call `mqttReporter.disconnect()` in graceful shutdown.
- `Dockerfile`: add `HASS_MQTT_BROKER_URL`, `HASS_MQTT_USER`,
  `HASS_MQTT_PASSWORD` to the Docker Compose / deployment template (values
  filled at runtime, not baked into the image).

### media-sync

- New file: `packages/web-server/src/mqttReporter.ts` (parallel structure).
- Hook into the sync scheduler completion event in
  `packages/sync-scheduler/` or `packages/web-server/`.
- Same three env vars.

### Shared env vars (both Docker images)

```
HASS_MQTT_BROKER_URL=mqtt://homeassistant.local:1883
HASS_MQTT_USER=media_tools
HASS_MQTT_PASSWORD=<secret>
```

Mosquitto requires a separate user per client (or a shared user) created via
the HA Mosquitto add-on UI. Credentials must not be committed; pass via Docker
secrets or `.env` file excluded from git.

---

## 7. Open questions for the user

1. **Mosquitto already set up?** Do you have the Mosquitto add-on installed
   and configured in HA, or should the implementation worker also include
   step-by-step HA-side setup instructions (add-on install, user creation,
   enabling MQTT integration)?

2. **Alerts only, or also metrics?** Is the primary goal one-time failure
   alerts (push notification when a job fails), or do you also want recurring
   metrics visible on a dashboard — queue depth, jobs per hour, last-run
   timestamps? That affects how many sensors are worth publishing and whether
   a Lovelace dashboard YAML snippet should be generated as part of the
   implementation.

3. **Push notifications specifically?** Should the implementation worker
   include an example HA automation that sends a Companion-app push
   notification when `last_failed_job` changes to a non-`"none"` value, or
   is wiring the MQTT sensors into HA enough and you will build automations
   yourself?

4. **Shared broker or separate?** If media-tools and media-sync run on
   different hosts (not the same Docker Compose stack), does the broker URL
   differ, or is there one central Mosquitto instance on the HA host that
   both reach over the network?

---

## 8. Decisions (2026-05-07)

Recommendation flipped from Option A (MQTT) to **Option C (webhook)**. Reasoning given by the user: zero npm dependencies, no broker setup beyond the URL, and the goal is alerts-only (not dashboards or retained state), which is exactly the surface webhooks are designed for.

1. **Transport — Option C (HA webhook).** Apps `fetch()` POST to the HA webhook URL configured at runtime. No `mqtt` npm package, no Mosquitto coordination on the app side (the user already has Mosquitto running, but it isn't load-bearing for this integration).
2. **Scope — media-sync only.** Skip media-tools for v1. The sync script is the higher-priority signal source. Media-tools may follow later but is not in W24b's scope.
3. **Two webhook URLs, two env vars** — `WEBHOOK_ERRORS_PRESENT_URL` (POST'd when a sync run fails) and `WEBHOOK_ERRORS_CLEARED_URL` (POST'd when the user clicks "Dismiss all errors" in the media-sync UI). Each URL fires its own HA automation directly — no payload-event branching needed in HA. Either URL unset disables only that side (no warnings); both unset disables the integration entirely. Considered a single-endpoint "error-count" state-mirror design but rejected — user prefers the simpler URL-as-event-channel HA pattern even at the cost of two env vars.
4. **Signals to publish — error state transitions.** Each URL has its own purpose:
   - **`WEBHOOK_ERRORS_PRESENT_URL`** — fired when a sync run fails (or a per-step failure occurs). Payload includes the failure details so HA can reference them in notifications.
   - **`WEBHOOK_ERRORS_CLEARED_URL`** — fired when the user clicks "Dismiss all errors" in the media-sync UI. Tells HA the situation is resolved so it can flip its sensor back to off, clear a persistent notification, etc.
   This makes the receiving HA side a single binary state ("media-sync has errors: yes/no") instead of an incident stream the user has to manually acknowledge in HA. No dashboard YAML, no metrics counters, no recurring "still alive" pings.
5. **HA-side setup docs — included.** The W24b worker output must include step-by-step instructions for: creating the webhook trigger automation in HA UI, copying the resulting webhook URL, and dropping it into media-sync's env (.env / Docker Compose). Even though the user already has Mosquitto, the webhook flow is different and the worker should not assume HA-side wiring is in place.

### Implementation footprint (revised — supersedes section 6 for media-sync)

- **media-sync:** new `packages/web-server/src/webhookReporter.ts` (or wherever the sync scheduler emits completion events). Two functions:
  - `fireErrorsPresent({ kind, message, runId, ... })` POSTs to `process.env.WEBHOOK_ERRORS_PRESENT_URL`.
  - `fireErrorsCleared()` POSTs to `process.env.WEBHOOK_ERRORS_CLEARED_URL`.
  Both wrap in `try`/`catch` and log but never throw — webhook delivery never blocks the sync pipeline.
- **HTTP method: POST.** Both URLs receive `POST` with `Content-Type: application/json` and the JSON body. HA's webhook trigger accepts GET/POST/PUT/HEAD but POST is canonical for "I'm sending you event data." (Decision 2026-05-07.)
- **No new dependencies** — uses Node's built-in `fetch` (≥18).
- **Per-URL gating, truly silent:** if either env var is unset, the corresponding fire path is a no-op. **No startup warning, no log lines, no error output.** The check is inline at the call site (`if (!process.env.WEBHOOK_ERRORS_PRESENT_URL) { return }`), not a startup-time announcement. Both unset = the entire integration is invisible. (Decision 2026-05-07: user wants the integration to feel optional, not "disabled with messaging.")
- **Env vars documented** in media-sync's `.env.example` and README.
- **Payload shape:**
  - `errors_present` URL: `{ kind, message, runId, firedAt, attributes? }`. `attributes` is a forward-compat bag.
  - `errors_cleared` URL: `{ firedAt }`. HA only needs to know the dismissal happened.
  HA's webhook trigger exposes the body as `trigger.json` for use in templated notifications.
- **Where `errors_cleared` fires from (revised 2026-05-07):** there is **no "Dismiss all errors" UI button in media-sync today** — only single-error dismissal via `DELETE /api/jobs/errors/:errorId` → `jobService.dismissError(errorId)`. Rather than building a new bulk-dismiss UI, **fire `errors_cleared` from inside `dismissError` whenever the dismissal causes the pending-error count to drop to 0** (i.e. the user just cleared the last error). This:
  - Reuses the existing UI (no new button, no new endpoint).
  - Matches the binary-state model HA wants: "media-sync has errors: yes / no."
  - The fire MUST happen after the store mutation succeeds, never before.
  - When the user dismisses an error but pending count is still >0, no fire — the integration only cares about transitions into the "no errors" state.
- **Pairing semantics:** if only one URL is configured, the integration is asymmetric — HA may show errors but never see them clear (or vice versa). The W24b worker output must include a clear note: "configure both URLs or neither."
- **media-tools:** **skipped** for v1 per scope decision above.
