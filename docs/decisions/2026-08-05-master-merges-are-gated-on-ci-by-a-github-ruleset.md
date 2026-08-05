# 2026-08-05 — `master` merges are gated on green CI by a GitHub ruleset (no bypass)

- **Status:** Accepted
- **Date decided:** 2026-08-05
- **Area:** infra | process
- **Source:** chat session 2026-08-05 (owner: "I don't want AI agents merging stuff that isn't passing CI"); charcuterie's `Master` ruleset used as the basis.

## Decision

Merging into `master` is enforced server-side by the repo's **`Master` GitHub ruleset** (`repos/Sawtaytoes/mux-magic/rulesets/16280413`), targeting `~DEFAULT_BRANCH`. The ruleset requires:

- **Required status checks** — every CI job must report success before a PR can merge: `lint`, `typecheck`, `unit-tests`, `e2e`, `storybook-build`, `build-budget` (integration: GitHub Actions, id `15368`). `strict` policy is off (the PR branch need not be up-to-date with `master`).
- **Pull request required, squash-only** — no direct pushes to `master`; `allowed_merge_methods` is `["squash"]`; `dismiss_stale_reviews_on_push` on; `required_approving_review_count` 0 (the auto-merge-passing-PRs workflow stays — see [2026-05-08](2026-05-08-auto-merge-passing-prs.md)).
- **Linear history.**
- **No bypass** — `bypass_actors` is empty; `current_user_can_bypass` is `never`. The admin/owner token cannot merge past red CI either, so an AI agent running as the owner **cannot** merge a failing branch.

The gate is enforcement, not just policy: [2026-05-08](2026-05-08-auto-merge-passing-prs.md) already said "still ask when the lint/CI gate is red," but nothing stopped a merge. Now the platform does.

## What we rejected — DO NOT revert to this

The prior `Master` ruleset that this replaced had **no `required_status_checks` rule** (it carried a `code_quality: errors` rule instead) and granted **admin bypass** (`bypass_actors: [{RepositoryRole 5, always}]`, `current_user_can_bypass: always`). That combination gated on *nothing CI-related* and let the owner token merge anything — exactly the hole the owner asked to close.

- Do **not** re-add a `bypass_actors` entry for the admin role (or any actor) to "unblock" a merge. A blocked merge means CI is red — fix CI, don't bypass the gate.
- Do **not** drop, rename, or narrow the `required_status_checks` contexts to make a merge go through. If a CI **job is renamed** in `.github/workflows/ci.yml`, update the ruleset's context list in the *same* change — a renamed job silently stops being a required check (a job that never reports is not "passing," but a required context that no longer exists is also not enforced).
- Do **not** swap the required checks back for the `code_quality` rule.

## Why it must not be re-litigated

This mirrors the charcuterie `Master` ruleset and the fleet-wide intent that no AI agent merges un-CI'd code. The owner stated it directly: *"Gate merging to master based on CI passing … I don't want AI agents merging stuff that isn't passing CI."* Re-adding a bypass or deleting the checks quietly restores the exact failure this closed.

To change *which* checks are required (e.g. CI adds or removes a job), update the ruleset via the API and note it here:

```sh
gh api repos/Sawtaytoes/mux-magic/rulesets/16280413            # inspect
gh api --method PUT repos/Sawtaytoes/mux-magic/rulesets/16280413 --input <ruleset.json>
```
