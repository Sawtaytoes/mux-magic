# 2026-08-03 — `master` is the only base branch; the revamp integration branch is retired

- **Status:** Accepted
- **Date decided:** 2026-08-03
- **Area:** process
- **Source:** PR #172 (`feat/mux-magic-revamp` → `master`); chat session 2026-08-03
- **Supersedes:** [2026-05-13 — Worker PRs target `feat/mux-magic-revamp`, not `master`](2026-05-13-pr-base-branch-is-feat-branch.md)

## Decision

All work — worker PRs, fixes, features — targets `master`. `feat/mux-magic-revamp` is retired: its last four PRs (#166–#169, the `@charcuterie/ui` migration) landed on `master` via PR #172, and the branch is deleted. There is no long-running integration branch anymore.

The harness `gitStatus` hint — *"Main branch (you will usually use this for PRs): master"* — is now **correct** for this repo. The 2026-05-13 decision existed specifically to override it; that override no longer applies.

Worker branches keep the `worker-<id>-<slug>` name and now branch from, and PR into, `master`.

## What we rejected — DO NOT revert to this

Do not re-create a long-running integration branch and do not open PRs against `feat/mux-magic-revamp` or any successor to it. If you find a doc, runbook, or worker spec that still says "PR against `feat/mux-magic-revamp`", that text is stale — the branch does not exist. Fix the doc; don't recreate the branch to match it.

Do not read the superseded 2026-05-13 file as current. It carries a supersession warning at the top for exactly this reason.

## Why it must not be re-litigated

The revamp integration branch existed to keep a multi-phase rewrite off `master` until it was coherent. That rewrite is done and merged, so the branch's only remaining effect was cost: two bases to keep in sync, a production image tag (`feat-mux-magic-revamp`) that drifted ahead of `master`, and a standing trap where the harness's own default-branch hint contradicted the repo's rule. The 2026-05-13 decision anticipated this exact moment — *"This holds until the revamp lands on `master` at Phase 6 — at which point this decision should be superseded, not silently ignored."* This file is that supersession.
