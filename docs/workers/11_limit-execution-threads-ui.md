# Worker 11 — limit-execution-threads-ui

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/11-limit-execution-threads-ui`
**Worktree:** `.claude/worktrees/11_limit-execution-threads-ui/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Add a UI for limiting concurrent execution threads. **Machine-dependent setting** — must persist on the server, not in localStorage and not in the query string. Per-run override is allowed but the override should reset to the server default each session.

### ⚠️ Open question — resolve with user before implementing

Where does server-side persistence go?

- **Option A — `settings.json` file** at the server's working directory. Simple, no DB. Survives restarts. Worker writes a new server route `GET/PUT /settings/execution-threads`. **Recommended for v1** if no existing settings store exists.
- **Option B — sqlite** alongside other server state. Heavier; only worth it if other settings are coming and we want one durable store.
- **Option C — environment variable** read at boot. No runtime mutation; user edits `.env` and restarts to change. Simplest but no UI for changing.

**Ask the user which option** before writing the persistence layer. Default to A if no answer.

### UI spec

1. **In the dev server settings / Sequence Builder** (find the natural surface — maybe a gear icon in PageHeader): a numeric field "Max concurrent execution threads" with current server value pre-filled. Save button.
2. **In the Sequence Run modal** (after worker `10` renames it to `SequenceRunModal`): a "scary" override section, collapsed by default. Expanded shows a numeric field defaulting to the server value, with a warning: "Overriding the server limit can cause resource exhaustion. This override applies to this run only."
3. The per-run override does NOT update the server setting.

### Server side

- New route: `GET /settings` returns the current settings object (initially just `{ executionThreadCap: number }`).
- New route: `PUT /settings` updates one or more settings. Schema-validated.
- The jobRunner reads the cap from the persisted source on each new job run.

### Files

- New: server routes for settings (`packages/server/src/api/routes/settingsRoutes.ts`)
- New: settings persistence module (`packages/server/src/tools/settingsStore.ts`)
- Web: settings UI component + integration into Sequence Run modal
- Tests for both

## TDD steps

1. Write failing tests:
   - Server route GET returns default settings.
   - Server route PUT persists and updates the cap.
   - SequenceRunModal renders the override section.
2. Implement persistence layer.
3. Wire routes.
4. Build UI.

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] User has decided on persistence option (A / B / C) — documented in PR
- [ ] Server routes pass tests
- [ ] UI shows current server value pre-filled
- [ ] Per-run override warns and applies only to this run
- [ ] Settings survive server restart (manual test if Option A)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Per-user settings (no auth in this app)
- Settings UI for other config beyond `executionThreadCap`
- Live-update the cap on running jobs (cap applies to new jobs only)
