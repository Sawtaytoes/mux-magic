# Orchestration â€” How this works

Started 2026-05-07. Driven by a single orchestrator Claude session at the user's request: "be the orchestrator of other Claudes."

## Roles

- **Orchestrator (this Claude session):** plans, writes briefs, spawns workers, owns `docs/CHECKLIST.md`, surfaces options docs to the user, never writes feature code.
- **Worker:** spawned via the Agent tool with `isolation: "worktree"`. Each worker gets its own worktree + branch, follows its inline brief, commits as it goes, pushes the branch, and (for Mux-Magic) opens a PR via `gh pr create`. For media-sync (Gitea remote), it pushes the branch and reports the name; user opens the PR in Gitea.

## File layout

- `docs/CHECKLIST.md` â€” live status board (orchestrator-only).
- `docs/orchestration/README.md` â€” this file.
- `docs/options/<slug>.md` â€” pause-for-call worker outputs (multiple approaches, recommendation). User picks.
- `docs/diagnostics/<slug>.md` â€” investigation outputs (no code change expected).
- `docs/dsl/<slug>.md` â€” DSL design / coverage docs.

## Worker rules (every brief reiterates)

1. Branch from current `master` (or `main` for media-sync if that's the default â€” check first).
2. Touch only files in your allow-list. If you need to change something else, **stop** and report.
3. Never modify `docs/CHECKLIST.md` or `docs/orchestration/**`.
4. Commit in small logical chunks; push branch as you go.
5. For pause-for-call tasks: write the options/diagnostics doc, open a **draft** PR, stop.
6. For implementation tasks: ensure tests/typecheck pass, open a regular PR, link to brief.
7. Never merge â€” orchestrator + user own that.
8. Never use `--no-verify`, `--force`, or destructive git operations.

## Worker brief inline-vs-file

Briefs are inlined into the Agent prompt for self-containment. The CHECKLIST tracks branch/PR/state.

## Updating CHECKLIST

Orchestrator updates CHECKLIST.md each time a worker:
- starts (running)
- pushes its branch (pushed)
- opens a PR (pr-open or awaiting-decision for drafts)
- finishes (ready-for-merge)
- gets merged or closed by user
