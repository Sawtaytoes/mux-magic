# Worker 04 — worker-conventions-agents-md

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/04-worker-conventions`
**Worktree:** `.claude/worktrees/04_worker-conventions-agents-md/`
**Phase:** 0
**Depends on:** none
**Parallel with:** 01 02 03

This is the **dry-run validation worker** for the huge revamp plan. Your mission is small (one file edit) so the focus is proving the worker template, branch model, and port/PID protocol all work end-to-end. After you ship, the other 50 workers reuse this exact pattern.

---

## Universal Rules

1. **Branch & worktree — create them first**
   ```powershell
   git fetch origin
   git worktree add .claude/worktrees/04_worker-conventions-agents-md -b feat/mux-magic-revamp/04-worker-conventions feat/mux-magic-revamp
   cd .claude/worktrees/04_worker-conventions-agents-md
   ```
   All work happens in that worktree. Never touch the primary checkout at `d:\Projects\Personal\media-tools`.

2. **Port + PID convention (set BEFORE running e2e)**
   ```powershell
   $env:PORT = Get-Random -Minimum 30000 -Maximum 65000
   $env:WEB_PORT = Get-Random -Minimum 30000 -Maximum 65000
   $servers = Start-Process -PassThru -NoNewWindow yarn -ArgumentList "prod:servers"
   $serversPid = $servers.Id
   # Wait for both servers to be listening
   ```
   - Run `yarn e2e` against those ports.
   - Tear down: `Stop-Process -Id $serversPid -Force`
   - **Never kill processes you didn't spawn.**

3. **Pre-push gate (in order):**
   ```
   yarn lint
   yarn typecheck
   yarn test
   ```
   If you changed typecheck/test/e2e code, re-run `yarn lint` last so Biome catches formatting changes.

4. **Pre-merge gate:** `yarn e2e` against your own PORT/WEB_PORT. (For this worker — docs-only changes — e2e is a validation of the **protocol**, not the change. It should pass cleanly because nothing about runtime behavior moved.)

5. **TDD:** for this worker, there is no application-code test to write. The "test" is a successful e2e run with your own PORT/WEB_PORT, proving the protocol works.

6. **Commit-and-push as you go.** Update your row in [docs/workers/README.md](README.md) at start (`in-progress`) and end (`done`).

7. **Test rules:** no snapshot tests, no screenshot tests, no VRT.

8. **Package manager:** `yarn` only. Never `npm`/`npx`.

---

## Your Mission

Update [AGENTS.md](../../AGENTS.md) to document the worker conventions used by this revamp. Four sections to add or update:

### Section 1 (new) — "Worker port/PID protocol"

Place this as a new top-level section after **"## Workflows & Collaboration"**. Content:

```markdown
## Worker port/PID protocol

Workers running e2e in worktrees must not collide with each other or with the user's
running dev servers. Pick random unused ports per session and tear down only your own PIDs.

### PowerShell (Windows)

```powershell
$env:PORT = Get-Random -Minimum 30000 -Maximum 65000
$env:WEB_PORT = Get-Random -Minimum 30000 -Maximum 65000
$servers = Start-Process -PassThru -NoNewWindow yarn -ArgumentList "prod:servers"
$serversPid = $servers.Id
# … run `yarn e2e` …
Stop-Process -Id $serversPid -Force
```

### Bash (Linux/Mac)

```bash
export PORT=$((30000 + RANDOM % 35000))
export WEB_PORT=$((30000 + RANDOM % 35000))
yarn prod:servers &
SERVERS_PID=$!
# … run `yarn e2e` …
kill -9 "$SERVERS_PID"
```

**Rule:** never `pkill` or `taskkill /F /IM node.exe` — those kill other workers' and the
user's servers too. Always target your captured PID.

If `playwright.config.ts` `reuseExistingServer` is true, set `CI=true` for your session
so Playwright spins up its own servers against your PORT/WEB_PORT.
```

### Section 2 (update) — "Pre-merge gate (run in order)"

In the existing **"## Testing"** section, replace the existing "Pre-merge gate (run in order)" subsection with this exact order (final `lint` step is new):

```markdown
### Pre-merge gate (run in order)

1. `yarn lint` — auto-fix formatting (biome + eslint); re-stage changed files
2. `yarn typecheck` — full monorepo type check
3. `yarn test` — unit + integration (vitest)
4. `yarn e2e` — Playwright end-to-end (using your own PORT/WEB_PORT, see "Worker port/PID protocol")
5. `yarn lint` — **re-run last** so Biome catches any formatting touched by typecheck/test/e2e fixes
```

### Section 3 (update) — "Role identification" inside `docs/agents/workflows.md` link

In the existing **"## Workflows & Collaboration"** section, update the role-identification bullets to match the new worktree model:

```markdown
**Role identification:**

- **Primary** (`d:\Projects\Personal\media-tools/`, branch `master` or `feat/mux-magic-revamp`):
  Never push unless told. Commit-as-you-go keeps work safe.
- **Worker** (`.claude/worktrees/<id>_<slug>/`, branch `feat/mux-magic-revamp/<id>-<slug>`):
  Commit and push every change to your sub-branch. Open a PR against `feat/mux-magic-revamp`.
  Only merge when explicitly told (or when AGENTS.md auto-merge gates are satisfied per
  [feedback_auto_merge.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_auto_merge.md)).
```

### Section 4 (new) — pointer to worker manifest

Add a one-paragraph section at the END of `AGENTS.md`:

```markdown
## Worker addressing

The Mux-Magic huge revamp uses sequential 2-hex worker IDs (`01`–`33`) with the manifest
table at [docs/workers/README.md](docs/workers/README.md). Each worker has a corresponding
prompt file at `docs/workers/<id>_<slug>.md`. Workers update their own row in the manifest
when they start (`in-progress`) and finish (`done`); IDs are never renumbered.
```

---

## Files

- [AGENTS.md](../../AGENTS.md) — the only file you edit
- [docs/workers/README.md](README.md) — update your own row at start and end only

---

## Verification checklist

Before opening your PR:

- [ ] Worktree created at `.claude/worktrees/04_worker-conventions-agents-md/`
- [ ] All four AGENTS.md sections added/updated as specified above
- [ ] Manifest row updated to `in-progress` at start (committed)
- [ ] `yarn lint` clean
- [ ] `yarn typecheck` clean
- [ ] `yarn test` all passing
- [ ] `yarn e2e` passing with your own PORT/WEB_PORT (this is the protocol validation)
- [ ] `yarn lint` re-run after e2e (catches Biome format)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row updated to `done` after PR merges

---

## Why this worker is the dry run

Worker `04` is the smallest meaningful worker in the plan: one file edit, no code changes, no test additions. If you can:
1. Create the worktree
2. Set PORT/WEB_PORT, spawn servers, capture PID
3. Run `yarn e2e` against your own ports
4. Tear down only your own PID
5. Get the PR through the pre-merge gate

…then the protocol is validated. Every subsequent worker (`01`, `02`, `03`, all of Phase 1, etc.) reuses this exact protocol. If `04` hits a snag, surface it immediately so the protocol can be revised BEFORE 50 workers try to follow a broken pattern.

**If you discover a protocol bug** (e.g. PORT collision still happens, PID capture doesn't work on Windows, or e2e fails because Playwright's `reuseExistingServer` overrides your env vars): stop, document the issue in your PR description, and ask the user how to revise the protocol before continuing. Don't paper over it — the next 50 workers will hit the same bug.
