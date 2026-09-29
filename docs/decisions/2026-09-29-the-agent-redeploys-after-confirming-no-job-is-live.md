# 2026-09-29 — The agent redeploys, after confirming no job is live

- **Status:** Accepted
- **Date:** 2026-09-29
- **Type:** process
- **Supersedes:** carve-out 2 of [Agents merge their own PRs as soon as CI is green](2026-08-13-agents-merge-their-own-prs-when-ci-is-green.md) — the TrueNAS redeploy is no longer the owner's step
- **Superseded by:** —
- **Source:** owner request in chat, 2026-09-29; the workspace's standing rule that the agent finishes its own deploy

## Decision

After a merge to `master` builds the image, the agent redeploys the TrueNAS app
itself — but only when no job is live. Read `GET /api/jobs/status-counts` and
redeploy only if `running`, `pending` and `paused` are all `0`. The check fails
closed: a request that fails, or a body that does not parse, means **do not
redeploy**. Otherwise wait, or report the live job and leave the redeploy for
later.

Then pull before redeploying and verify with a marker from the new build:

```bash
ssh root@storeman.octen "midclt call -j app.pull_images mux-magic && midclt call -j app.redeploy mux-magic"
```

The marker is the hashed `index-*.css` / `index-*.js` the merge commit builds,
present in `/app/packages/web/dist/assets` inside the running container and
referenced by the served page. A 200 is not proof — the old image answers too.

## Context

The 2026-08-13 record kept the redeploy as "a separate, deliberate step" for
the owner. The workspace settled the opposite on 2026-08-15 and 2026-08-17: the
agent finishes its own deploy, there is no maintenance window, and "merged — you
just need to redeploy" is unfinished work. The two rules disagreed, and an
agent working here on 2026-09-28 had to pick one.

What the carve-out was protecting is real: a redeploy restarts the server, and
a restart ends every job in flight, including a `paused` one waiting on a
prompt answer. The job check keeps that protection without handing the step
back to the owner.

## What we rejected — DO NOT revert to this

- **"The redeploy is the owner's call; report what still needs a redeploy."**
  The owner does not redeploy by hand, so a merged change sat undeployed until
  somebody noticed.
- **Redeploying without the job check.** It ends live work.
- **Counting jobs with `grep -c` or reading only `running`.** `grep -c` prints
  `0` for a failed request as well as an idle server, and a `pending` or
  `paused` job ends on a restart just the same.

## Why

A merge that is not deployed is invisible work. The job check is the only thing
the owner's step was adding, and a machine can do it more reliably.

## Evidence

- Owner, 2026-09-29, on the conflict between this repo's rule and the
  workspace rule: *"Fix these issues"*.
- `GET https://mux-magic.octen.dev/api/jobs/status-counts` on 2026-09-29 returned
  `{"running":0,"pending":0,"paused":0,"failed":0,"completed":0,"cancelled":0,"skipped":0,"exited":77}`.
- The 2026-09-28 redeploy for the tokens bump (PR #312) ran after this check
  returned 0 running and 0 pending.
