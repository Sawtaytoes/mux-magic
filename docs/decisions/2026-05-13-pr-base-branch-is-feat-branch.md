# 2026-05-13 — Worker PRs target `feat/mux-magic-revamp`, not `master`

> [!WARNING]
> **SUPERSEDED on 2026-08-03 by [`master` is the only base branch](2026-08-03-master-is-the-only-base-branch.md).**
> This used to be the decision. It is kept for history — do NOT implement
> what's below. The current rule is in the linked file: the revamp branch is
> deleted and everything targets `master`.

- **Status:** Superseded by [2026-08-03-master-is-the-only-base-branch](2026-08-03-master-is-the-only-base-branch.md)
- **Date decided:** 2026-05-13 (branch model, PLAN.md §2); reinforced by the worker-72-on-master revert (PR #142)
- **Area:** process
- **Source:** [docs/workers/PLAN.md](../workers/PLAN.md) §2; memory `project_pr_base_branch.md`

## Decision

During the revamp, **all** worker PRs target the long-running integration branch `feat/mux-magic-revamp`. `master` remains the repo's main branch but is **not** the current working base — it only receives the integration branch at explicit phase boundaries (end of Phase 0, end of Phase 6). Worker branches are named `worker-<id>-<slug>` (git refuses to nest a branch ref under the existing `feat/mux-magic-revamp` ref).

## What we rejected — DO NOT revert to this

Do not open PRs against `master`. A worker-72 PR landed on `master` and had to be **reverted** (PR #142) and re-landed against the feature branch. Note the trap: the Claude Code harness `gitStatus` literally says *"Main branch (you will usually use this for PRs): master"* — that hint is **wrong for this repo right now** and will actively mislead you. As the user put it: *"The main branch is `master`. It's just that right now, we're working off a feature branch."*

## Why it must not be re-litigated

Basing on `master` mid-revamp splits work across two bases, forces reverts, and breaks the phase-boundary merge model. This holds until the revamp lands on `master` at Phase 6 — at which point this decision should be superseded, not silently ignored.
