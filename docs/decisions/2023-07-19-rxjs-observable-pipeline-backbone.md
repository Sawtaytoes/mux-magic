# 2023-07-19 — The pipeline is built on RxJS Observables

- **Status:** Accepted
- **Date decided:** 2023-07-19 (first commits, pre-rename); reinforced repeatedly since
- **Area:** core
- **Source:** commits `984a62d2` (foundational), `63246714`, `8e471f8b`

## Decision

File discovery, scraping, matching, and file operations are composed as **RxJS Observable** pipelines (`concatMap`/`mergeMap`/`scan`/`toArray`, etc.). This gives controlled concurrency (the task scheduler / per-job thread budget), sequential file ordering where needed, and a single composition model across CLI, API, and sequence runner. 150+ files in `packages/core/src` import from `rxjs`. Every command module returns an Observable.

## What we rejected — DO NOT revert to this

Do not "modernize" command modules to plain `async/await` / promise chains, and do not introduce a second concurrency model alongside rxjs. The per-job thread budget, in-flight cancellation (AbortController teardown), progress emission, and per-file pipelining (Shape 2 — see [per-file pipelining](2026-05-16-per-file-pipelining-shape-2.md)) all assume the operator/Observable contract. Promise-ifying a handler breaks cancellation and scheduler admission.

## Why it must not be re-litigated

Observables are the project's backbone, not a stylistic choice — concurrency control, cancellation, and pipelining are built on them. Replacing rxjs with async/await would be a massive, wrong undo that quietly removes those guarantees. New work composes operators; it does not escape them.
