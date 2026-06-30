# 2026-05-07 — Worker session protocol: worktree, push-as-you-go, flip your own row

- **Status:** Accepted
- **Date decided:** 2026-05-07 (earliest component captured in memory; see timeline in Source)
- **Area:** process
- **Source:** branch/commit conventions captured 2026-05-07/08 (`feedback_branch_convention.md`, `feedback_commit_convention.md`); flip-your-own-row captured 2026-05-15 (`feedback_workers_flip_own_done.md`); worktree-isolation **re-asserted 2026-05-20** after the worker-73 incident (`feedback_workers_use_worktrees.md`). See [docs/agents/workflows.md](../agents/workflows.md).

## Decision

A worker session:

1. **Works only inside its git worktree** at `.claude/worktrees/<id>_<slug>/`. Never `git checkout` another branch in the primary checkout, and never run worker edits there.
2. **Commits and pushes after every logical group**, without asking. Non-trivial work starts on a `feature/<name>` (or `worker-<id>-<slug>`) branch — never commit directly to `master`.
3. **Flips its own MANIFEST.md row** from `in-progress` to `done` after merge (via a `chore(manifest)` change), rather than leaving it for the user.

## What we rejected — DO NOT revert to this

- Do not "just work in the current checkout because I was told I'm worker N." Worker 73 ran in the **primary** checkout, branch-jumped, and left stray mods + an unexpected stash. User: *"You should be in a worktree, not my main branch. Stop changing it!"*
- Do not ask for permission before each commit/push. User: *"commit and push as you go."*
- Do not leave the manifest bookkeeping for the human. User: *"No, you flip the manifest. All workers should do that themselves. I won't be doing it."*

## Why it must not be re-litigated

These are explicit corrections, not preferences to re-derive. Working in the main checkout corrupts the user's working tree; orphaned `in-progress` rows make the manifest lie about progress; pausing for per-commit approval defeats the parallel-worker model. See also [PR base branch](2026-05-13-pr-base-branch-is-feat-branch.md) and [auto-merge passing PRs](2026-05-08-auto-merge-passing-prs.md).
