# 2026-05-16 — "Pure functions" means remove mutation, NOT extract env reads

- **Status:** Accepted
- **Date decided:** 2026-05-16
- **Area:** core / process
- **Source:** worker 2c, commits `ebf970b1` (doc reframe), `2c473bb0` (PR #124); the rejected attempt was **PR #121 (closed, branch deleted)**

## Decision

A "pure-functions sweep" in this codebase means: find and rewrite **mutation** — `.push` / `.splice` / `.pop` / `.shift` / `.unshift` / in-place `.sort` / `.reverse` / `arr[i] = x` / `obj.field = x` — in favor of `.map` / `.filter` / `.reduce` / `.toSorted` / spread-returning functions. Reading `process.env` once at the edge is fine. Intentionally stateful modules (`transcodeTempStore`, `progressEmitter`, the `isNetworkPath` cache) are on a documented skip-list and must not be redesigned.

## What we rejected — DO NOT revert to this

A whole session once misread "pure functions" as a **referential-transparency** sweep and started extracting `process.env` reads into injected parameter objects (e.g. `pickAnidbCacheDirInput({ fromEnv })`) and wrapping `??` / `||` / ternary operators in named helpers. That was a category error — **PR #121 was closed and its branch deleted.** Do not "purify" env reads, do not inject `getPlatform` / `getCwd` everywhere, and do not rip out the intentional stateful caches.

## Why it must not be re-litigated

The worker-2c prompt's strict-purity framing is exactly what re-tempts an agent down the path that was already reverted once. The cost (a full closed PR) was paid. The sweep is about mutation, full stop.
