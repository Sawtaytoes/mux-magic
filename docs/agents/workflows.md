# Workflows & Collaboration

## Multi-Agent Workflow

This repo can be cloned into sibling working trees named `Mux-Magic-worker-<name>/` so several Claudes can work in parallel without stepping on each other. **Identify your role from your repo's folder name:**

- **Primary** (`Mux-Magic/`, no suffix): you're the canonical Claude. `master` lives here; worker trees clone from it. Existing push rule applies unchanged: do NOT push to `master` unless the user explicitly says so. Because nothing leaves the local repo until the user asks, **commit-as-you-go is the safeguard** — each logical group must land in its own commit so unpushed work is never sitting in the working tree as a single uncommitted blob the user can't recover.
- **Worker** (`Mux-Magic-worker-<name>/`): you're the worker named `<name>`. Work happens on a feature branch and is pushed continuously, not held until the user asks.

## Worker Workflow

If your repo folder name starts with `Mux-Magic-worker-`:

1. **Create a feature branch** at the start of any non-trivial work — don't commit directly to `master`. Naming: `feature/<short-description>` (e.g. `feature/jobs-progress-followup`). If a feature branch is already checked out and matches the task, keep using it.
2. **Commit AND push** to that branch as you go. This is the explicit reversal of the primary's "never push" rule — the push is what makes your work visible to the user and lets the primary (and other workers) see what you're up to. Push after every commit; don't batch.
3. **Don't merge to `master` autonomously.** Wait for the user to explicitly say "merge it" or equivalent. Once told, merge your feature branch into local `master` and push.
4. Everything in `Commit conventions` below (commit-as-you-go, partial-file splits, focused commits) still applies — you're just additionally pushing the branch on every commit.
5. **For UI changes, leave a dev server running when you hand off / open the PR.** The user reviews UI before approving — they can't tell from a diff whether a button morphs, whether copy feedback flashes, or whether a popover aligns. Start `yarn api-dev-server` (it picks up `PORT` from `.env` — never inline-override it with `$env:PORT=...`) in the background before announcing the PR, and tell the user the URL (`http://localhost:<PORT>/builder/` or `/`) so they can poke at it. Stop the server when they say they're done or when you merge.

The push-as-you-go rule is what keeps multiple workers from drifting into each other's blast radius — when the user can see all branches at once, conflicts get spotted early instead of at merge time.

**After any `git pull`** (in either repo, primary or worker): if the pull touched `package.json` or `yarn.lock`, run `yarn install` before doing anything else. Skipping this gives confusing "module not found" or "wrong version" failures that look like real bugs but are just stale `node_modules`. Quick check: `git diff HEAD@{1} HEAD -- package.json yarn.lock` shows whether the pull moved either.

## Worktree Workflow

When working in a git worktree (created with `EnterWorktree`):

1. **Commit as you go** — after each logical group of changes and passing tests, create a commit. Don't batch work into a single commit at the end.
2. **Push to a PR, don't merge** — when all work is complete and tests pass, push changes to a GitHub PR and wait for the user to review. Do not merge autonomously; the user will review the PR and tell you when to merge.
3. **Start a dev server when ready for testing** — once the PR is created and ready for review, start `yarn api-dev-server` on a random port (it picks up `PORT` from `.env`). This allows the user to test the changes in their browser before approving.
4. **Kill the server after merge** — once the user tells you to merge and the merge is complete, stop the dev server.

The user will review changes by examining the PR and testing the running server, then explicitly ask you to merge when ready.

## Explaining Behavior Changes to the User

When you finish a non-trivial change — a bug fix, a behavior change, a new code path — end the response with a **"In plain English what now happens"** section that traces the new behavior end-to-end using the user's *actual* values (file paths, IDs, command names from this conversation), not placeholders.

Format: numbered steps, each step one short sentence. No type names, no module paths, no jotai/atom/zod/observable jargon. The reader is someone who knows the *product* (clicked ▶ on a step, picked a path variable, has a YAML file) but not the *code* (doesn't care which file holds the validation or what an atom is).

Concrete example from a real session:

> **In plain English what now happens with your YAML:**
>
> 1. You click ▶ on step2.
> 2. The single-step runner sees `sourcePath: {linkedTo: step1, output: folder}`.
> 3. It looks up step1, finds its source path resolves to `G:\Anime\Daemons of the Shadow Realm [anidb-19451]` (via `@pathVariable_icp58k`), and finds `extractSubtitles`' built-in `outputFolderName` is `EXTRACTED-SUBTITLES`.
> 4. It glues them together → `G:\Anime\Daemons of the Shadow Realm [anidb-19451]/EXTRACTED-SUBTITLES`.
> 5. POSTs that to `/commands/modifySubtitleMetadata`. Step runs.

**Why this matters:** large stretches of this repo are being written by LLMs the user no longer reviews line-by-line. The user knows the product surface (the React builder, the YAML format, the commands) but not the current internals. A plain-English trace is how they *verify the LLM didn't do something insane* — if step 3 in your trace doesn't match what they'd expect, that's the catch point.

**When to include it:**

- Bug fixes where the new behavior visibly differs from the old.
- Behavior changes the user will see in the UI or in YAML.
- Changes to anything they triggered manually in this conversation.

**When to skip:**

- Pure refactors with no behavior change (say so explicitly instead).
- Tests-only changes.
- Doc-only changes.

The product-jargon ("step2", "▶", "YAML", command names from `commands.ts`) is *welcome* — that's the vocabulary the user thinks in. The code-jargon (atom names, file paths, type names, framework terms) belongs in the technical summary above the trace, not in the trace itself.

## Commit Conventions

Commit *as you go*, not at the end of the session. After each logical group of changes lands and tests pass, commit it — one phase at a time. Don't batch a multi-step task into a single end-of-session commit just because the work all happened in one conversation; the user reviews incrementally, and a single 10-file commit is much harder to read than three focused 3-file commits.

If a single file legitimately touches two unrelated concerns (e.g. a feature change and an infrastructure fix in the same route file), keep them in separate commits — use `git add -p` to selectively stage hunks, or temporarily revert one set with the Edit tool, commit the other, then re-apply. Mixing is the wrong shortcut.

Natural commit points: a todo item flips to completed, a phase of a Plan-mode plan finishes, tests pass for a self-contained change, a refactor wraps up before the next one starts.

Push rule depends on which role you are — see `Multi-Agent Workflow` above. Primary: never push without explicit instruction. Worker: push every commit to your feature branch; only merge to `master` when told.

## Worker Addressing

The Mux-Magic huge revamp uses sequential 2-hex worker IDs (`01`–`35`+) with the manifest table at [docs/workers/MANIFEST.md](../workers/MANIFEST.md). Each worker has a corresponding prompt file at `docs/workers/<id>_<slug>.md`. Workers update their own row in the manifest when they start (`in-progress`) and finish (`done`); IDs are never renumbered.

## Worker Port / PID Protocol

See [worker-port-protocol.md](worker-port-protocol.md) — how to pick random ports and tear down only your own PIDs so parallel workers don't collide.

## npm Publishing

See [npm-publishing.md](npm-publishing.md) — only `@mux-magic/tools` is published; uses the `shared-v<X.Y.Z>` tag pattern.
