# The AniDB cache, and the library that would replace half of it

**Nothing has changed yet. This is the state and the option, so the next agent does not
re-derive it or adopt the wrong half.**

## What this repo does today

`packages/core/src/tools/anidbApi.ts` caches AniDB answers itself:

| Part | Where |
| --- | --- |
| A 7-day TTL over a directory of files | `ANIME_TTL_MS`, `getAnidbCacheDir()` |
| `MIN_REQUEST_INTERVAL_MS = 2_500` — AniDB publishes 1 request per 2 s, padded by 0.5 s | `throttle()` |
| A **promise chain**, not a timestamp check, so N concurrent callers space out like N sequential ones | `throttleChain` |
| Single-flight by `aid`, so two lookups of one anime are one request | `inFlightByAid` |

All of it is correct. The comments explaining *why* the throttle is a chain and not a bare
`Date.now()` comparison are the most valuable lines in the file — a bare check lets a
parallel sequence group burst past the cap and earn a ban.

## What `@charcuterie/server/http` would give it

The library shipped this in **0.4.0** (`createHttpCache`, `createThrottle`, `lifetime`). It
owns the **policy** and never the store, so the directory of files stays exactly where it is
and becomes a `{ read, write }` adapter.

- `ANIME_TTL_MS` becomes a `lifetime`.
- `MIN_REQUEST_INTERVAL_MS` becomes `minIntervalMs`, and the library's queue replaces
  `throttleChain` outright.
- `inFlightByAid` is already what the library does per key — that part is a **deletion**,
  not a gain.
- **The actual gain is `cooldownMs`, which this repo does not have.** Everything stops for a
  set time after a failure, instead of every caller discovering the outage on its own. That
  is the behaviour that stops a run of errors turning into an AniDB ban.

An `"unavailable"` outcome — a socket error, a 5xx, a spent budget — is **never cached**.
Caching one unreachable minute is how a week goes by with no metadata.

## Before adopting

- This is a **CLI as well as a server**. The disk cache, not the in-process throttle, is what
  protects AniDB across separate invocations, so the store adapter must keep writing files.
- Read the workspace runbook first — it carries the measured numbers from the one app that
  has adopted, and the two traps that cost that adoption a false-pass deploy:
  `agentic/docs/runbooks/charcuterie-server-http-cache-adoption.md`.
- ⚠️ **A caret on a `0.x` version pins the MINOR.** Bump every workspace package that names
  `@charcuterie/server` in the same change, or Yarn installs two copies and nothing goes red.
