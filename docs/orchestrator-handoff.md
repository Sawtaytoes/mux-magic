# Orchestrator Handoff — React Migration Recovery

You are the new orchestrator for the media-tools React migration recovery. The prior orchestrator (Claude Opus 4.7) handed off because the session got expensive. **You are recommended to run as Sonnet 4.6, high effort** — the architectural work is done; what remains is execution. Switch to medium effort if budget tightens; don't drop to Haiku (orchestration needs nuanced prompt writing).

This doc is your context starter. Read it top-to-bottom once, then keep [docs/react-migration-checklist.md](react-migration-checklist.md) and [docs/react-migration-prompts/README.md](react-migration-prompts/README.md) open as your live state.

---

## Big picture

The repo is in the middle of a vanilla-JS → React 19 migration that previously drifted from its own checklist. A recovery plan (see [react-migration-recovery-handout.md](react-migration-recovery-handout.md)) was authored to reach feature parity with the pre-migration vanilla builder.

**The user is currently in manual verification mode.** They reverted W4A's master merge so they could verify the React app end-to-end before re-merging. They're finding regressions and reporting them; the orchestrator captures fixes into worker prompts or fixes inline (depending on size).

**Master is intentionally pre-migration.** `origin/master` is at `ff92625` (a pre-React-migration dependabot merge). All migration work lives on `react-migration`. The eventual re-merge happens after verification + all Phase 5/6/7 workers ship.

---

## Worker hierarchy + naming convention

**Naming rule the user set:** parallel workers share the number with a letter suffix; sequential next-phase is a new number.

- Same number + letter (W2A, W2B, W5A, W5B, W6A, W6B) → run concurrently within a phase
- New number (W6 → W7) → sequential next phase, not a sibling of W5A/B/C

**Current worker state** (also tracked in [react-migration-checklist.md](react-migration-checklist.md)):

| Worker | Phase | Status | Branch / Worktree |
|---|---|---|---|
| Pre-W0 → W5C | 0–5 | ✅ All Done + merged | various |
| W6A | 6 — e2e completion | 🔄 Running (user just spawned) | `.claude/worktrees/w6` on `e2e-completion` |
| W6B | 6 — dnd-kit swap | ✅ Done + merged (commit `dc11213`) | was `.claude/worktrees/w6b` on `feat/dnd-kit-migration` |
| W7 | 7 — Modal primitive + Storybook reorg + missing toggle | ⬜ Ready (not spawned) | will run in `.claude/worktrees/w7` on `feat/storybook-reorg` |

WBN-A (boolean rename, server) is also done on `feat/boolean-is-has-naming`. WBN-B (web/shared rename) is deferred until after react-migration merges to master.

**Worker prompts** live in [docs/react-migration-prompts/](react-migration-prompts/). One file per worker. To spawn a worker, open a fresh Claude Code session in the working directory and paste the contents between the `---` markers from the relevant prompt file.

---

## Your role

You are the **orchestrator**. You do NOT spawn workers directly (the prior orchestrator tried subagents; the user prefers spawning manually in separate Claude sessions). Your job is:

1. **Maintain the checklist.** When a worker reports done or partially done, update [react-migration-checklist.md](react-migration-checklist.md) — both the Worker Status table and the Progress Log.
2. **Merge worker branches** into `react-migration` when they report ready. Resolve any checklist conflicts (the common merge-conflict file).
3. **Write worker prompts** when the user identifies new work. Follow the pattern of existing prompts (see W6A/W7 as recent examples).
4. **Fix small inline issues** the user reports during verification — duplicate checkboxes, missing imports, config gaps, etc. Keep these to ~10 minutes of work each. Anything larger gets its own worker prompt.
5. **Update worker prompts** when the user adds context that affects an unspawned worker's scope (the W6A/W6B/W7 framings are good examples of this).
6. **Be a scope gardener** — see the "Scope discipline" section below.

You do not write production code unless it's a small inline fix (e.g., the Vite proxy, the duplicate-checkbox removal, the URL-syncing feature). Larger work goes into prompts.

---

## Scope discipline — the [PARITY] / [POLISH] split

The user is explicitly limiting scope to **parity with the previous version** for now. They have a backlog of new features (in `g:\Anime\media-tools-tasks.md`, their personal tasks doc — not in the repo) that's deferred until parity is reached.

Categories you should flag:

- **`[PARITY]`** — restoring something that worked in the previous version. Default ship.
- **`[POLISH]`** — improvement beyond parity. The user will decide keep/defer/kill.

Examples of [POLISH] you should label clearly:
- Adopting new libraries (dnd-kit was labeled [POLISH] in W6B; the swap shipped but with a "bail to SortableJS" escape hatch)
- "Future-proofing" suggestions
- Refactors that aren't fixing a bug
- New features not present in the previous version

Examples of [PARITY] (ship without asking):
- Restoring deleted features (URL `?seq=` reader; tooltips from Zod schemas; missing builder controls)
- Test infrastructure that's a prerequisite for verification (vitest cleanup, ESLint ignores, Vite proxy)
- Observability that blocks verification (version footer that displays the git SHA — currently stuck on "dev" per W5B's pending build-script fix)

The user noticed me drifting toward [POLISH] framings ("long-term win past this migration") and corrected me to focus on present-day rationale. Stay on present-day framing.

---

## Branch / merge model

- `react-migration` is the trunk. All worker branches merge into it via `git merge --no-ff`.
- `master` is intentionally pre-migration; do NOT push anything to it. The user does the eventual master re-merge themselves.
- Worktrees live under `.claude/worktrees/<worker-id>/`. They're gitignored and ephemeral.
- The `feat/boolean-is-has-naming` branch is separate (WBN-A initiative); leave alone.
- The `e2e-tests` branch is W4B's legacy — W6A extends it as `e2e-completion`.

When merging a worker branch:
1. `git fetch origin && git merge --no-ff origin/feat/<worker-branch> -m "Merge ..."`
2. Resolve the (almost always) checklist conflict by combining both sides' rows
3. Run `yarn install` if the merge changed `package.json`/`yarn.lock` — common after worker branches add deps
4. Run the full gate (`yarn test run && yarn typecheck && yarn lint`)
5. Push

---

## Recent infrastructure fixes — keep these in mind

These landed because the user kept hitting them during verification. They're NOT migration-specific; they're DX/observability gaps that block verification:

| Commit | What | Why |
|---|---|---|
| `1e7cf03` | ESLint ignores `**/storybook-static/**` | Storybook build output trips lint |
| `88802a6` | `vitest.setup.ts` adds `afterEach(cleanup)` | Browser-mode tests accumulate DOM across cases otherwise |
| `2c853d0` | ESLint ignores `e2e/`, `examples/`, `**/scripts/**`, `**/public/**` | `projectService: true` parser requires every file be in a tsconfig |
| `e913473` | Vite dev proxy for `/files`, `/commands`, `/queries`, `/jobs`, `/sequences`, `/server-id`, `/version`, `/openapi.json` to port 3000 | API calls from dev SPA were hitting Vite SPA fallback (HTML 404) instead of Hono |
| `90d9d2f` | `.gitignore` + ESLint ignore for `.playwright-mcp/` | User added Playwright MCP; debug snapshots accumulate |

**Reliability pattern:** when a worker branch adds a dep, anyone pulling needs to `yarn install` before gates pass. Document this in handoff reports so workers don't waste time debugging "Cannot find module."

---

## Open verification findings — not yet resolved

These are things the user has flagged during verification that aren't yet addressed by a shipped fix:

1. **Version footer shows "git: dev · built dev · node v24.15.0"** even in Docker — `scripts/build-version.cjs` isn't running in production builds. Captured in W5B's scope expansion (Stream 5 of W5B.md) but W5B reported done without fixing this specifically. W7 or a small inline fix needed.

2. **e2e tests never wired into CI** — W6A is running now to address this; it's restoration (the legacy e2e suite worked before the React migration, just wasn't ported to current CI).

3. **PathField breadcrumb still shows `//media`** (doubled slash) — may have been a symptom of the failed API call before Vite proxy fix landed. If user reports it again, investigate `FileExplorerModal`'s breadcrumb rendering.

4. **PromptModal** untested in W4B/W6A's specs — triggered by SSE prompt events; complex to e2e-test without a real running job. Deferred to W5 / future worker.

5. **CommandHelpModal doesn't render in Storybook** — captured in W7's prompt as part of the audit of broken modal stories.

---

## Scope-gardener tactical advice

When the user reports a finding, ask yourself:

1. **Is it [PARITY] or [POLISH]?** If unclear, ask the user before writing the fix.
2. **Does an existing worker own this?** Check the prompts. Fold into the existing prompt if the worker hasn't spawned yet. If the worker already spawned and is in flight, fix inline OR write a small follow-up commit.
3. **Is it small enough to fix inline?** ~10 minutes including tests. If yes, fix and commit. If no, write a new worker prompt.
4. **Does it block verification?** If yes, prioritize over backlog items. Examples: the duplicate-label fix, the Vite proxy, the URL `?seq=` reader.

When you write a worker prompt, follow the pattern in `react-migration-prompts/W6B.md` or `react-migration-prompts/W7.md`. Key sections every prompt has:
- Working directory + branch + worktree setup
- Required reading (handout + checklist + relevant code paths)
- Step-by-step tasks with commit message templates
- Pre-push gate (Universal Rule #2)
- Forbidden patterns (Universal Rule #4 — no snapshot/VRT tests)
- Checklist updates (Universal Rule #8)
- When-done reporting structure

---

## Memory files relevant to this work

The orchestrator session has access to these (in `~/.claude/projects/d--Projects-Personal-media-tools/memory/`):

- `feedback_no_snapshot_tests.md` — never use `toMatchSnapshot`, `toHaveScreenshot`, Percy, Chromatic
- `feedback_rename_strategy.md` — ESLint catches declarations not references; use Edit with `replace_all` per file for local renames, grep-then-rename for exported symbols
- `feedback_shrinking_inventory_pattern.md` — when migrating away from a bridge, keep the inventory file shrinking commit-by-commit
- `feedback_auto_merge.md` — user prefers auto-merging when tests pass
- `feedback_commit_convention.md` — commit and push after each logical group; don't ask permission
- `feedback_package_manager.md` — yarn, never npm/npx
- `feedback_agents_md_rules.md` — four code rules incl. no single-letter names

These memories are durable; you'll have access automatically.

---

## Quick start for your first turn

1. Read this file and [react-migration-checklist.md](react-migration-checklist.md).
2. Check the current branch tip: `git log --oneline -5`. The most recent commit as of this handoff is `c04d6e7` (duplicate hasDefaultRules checkbox removal).
3. Wait for the user to:
   - Report a verification finding → triage per scope-gardener flow above
   - Report a worker reporting done → merge the branch, update checklist, push
   - Ask you to draft a prompt for a new finding → follow the prompt-pattern guide above

The user knows the workflow. They'll tell you what they need.

---

## Tone notes from the prior orchestrator's experience

- The user appreciates **explicit reasoning shown** — the "Insight" callouts in messages help them understand why you're making decisions.
- The user **dislikes unnecessary hedging or equivocation** — pick a recommendation and own it. If they disagree, they'll override.
- The user is **technically deep** — don't over-explain basics, but DO explain non-obvious architecture decisions.
- The user is **scope-conscious** — they actively notice when you're padding scope. The [PARITY]/[POLISH] tag is a contract you should keep.
- When stuck, **ask via AskUserQuestion** with 2-4 concrete options. The user prefers picking from options to free-text typing.

Good luck. You're inheriting a stable architecture; the hard part of the migration is over.
