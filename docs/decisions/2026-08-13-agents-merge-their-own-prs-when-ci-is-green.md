# 2026-08-13 — Agents merge their own PRs as soon as CI is green

- **Status:** Accepted
- **Date decided:** 2026-08-13
- **Area:** process
- **Source:** owner, on being told PRs #220 and #221 were green but unmerged because AGENTS.md said "only merge when told" — *"We should change that then. I want you to start merging now."*

## Decision

An agent **merges its own PR itself, without asking, the moment CI is
green.** Squash merge, through the API:

```bash
gh api -X PUT repos/Sawtaytoes/mux-magic/pulls/<n>/merge -f merge_method=squash
```

(`gh pr merge` trips the shared-worktree lock; the API call does not.)

Two carve-outs remain the owner's call:

1. **Someone else's PR** — merge only your own work.
2. **What a merge sets in motion that a merge can't undo.** A master merge
   builds and pushes `ghcr.io/sawtaytoes/mux-magic:latest`, but it does *not*
   put that image in front of the running app; the TrueNAS redeploy is a
   separate, deliberate step. Report what shipped and what still needs a
   redeploy.

## What we rejected — DO NOT revert to this

**"Open a PR against `master`; only merge when told."** That was the Worker
role's rule and it is now wrong. Its failure mode is not a bad merge — it is
a queue: green PRs sit open, the next agent inherits a stack of unmerged
branches it has to reason about, and the owner becomes the bottleneck for
work that already passed every gate he set up.

Do not reintroduce an "ask before merging" step, and do not soften this into
"merge when green *and* the change looks low-risk" — risk is what CI and
review are for, not a second judgement call at merge time.

## Why it must not be re-litigated

The green gate *is* the permission. Merging to `master` is hard-gated by a
GitHub ruleset with **no bypass** — not even the owner's token can merge past
red CI ([2026-08-05](2026-08-05-master-merges-are-gated-on-ci-by-a-github-ruleset.md)).
Asking on top of that adds a human round-trip that cannot catch anything the
gate didn't, and costs a session boundary each time: the agent that did the
work is usually gone by the time the answer arrives.
