# WBN-A spawn prompt â€” Boolean rename (server side)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\Mux-Magic`.

---

You are Worker WBN-A â€” first half of the Boolean Naming Rename initiative.

**Working directory:** `d:\Projects\Personal\Mux-Magic`
**Branch:** `feat/boolean-is-has-naming` (checkout this branch; do not switch to a new one)
**Your model:** Sonnet 4.6, medium effort
**Your scope:** `packages/server/**/*.{ts,tsx}` â€” ALL of it
**Your role:** Fix every `@typescript-eslint/naming-convention` violation for booleans in the server package. Rename booleans to start with `is`, `has`, `should`, `can`, `will`, `did`, or `does`.

## Required reading before doing anything

1. [docs/boolean-rename-prompts/README.md](README.md) â€” the initiative overview, including why server runs before web.
2. [AGENTS.md](../../AGENTS.md) Â§"Code Rules & Conventions" rule #4: "Booleans start with `is` or `has`." This worker enforces that rule across server code.
3. [eslint.config.js](../../eslint.config.js) â€” read the existing `@typescript-eslint/naming-convention` rule that Haiku added in commit `cff5a2d`. Verify it matches what you'd want for booleans. If the rule is malformed or too narrow (e.g., only catches `const`, missing `let`/`function-param`/`property`), **fix the rule first** as your first commit.

## Critical context

- **The rule is enabled globally** â€” `yarn lint` on the whole repo will report violations in web, server, and shared. You are fixing **only server**. Web is W2Aâ€“W2D's active area; touching it now creates merge hell.
- **Web has its own worker (WBN-B)** scheduled after the React migration merges to master.
- The `feat/boolean-is-has-naming` branch is currently ahead of `react-migration` by the two ESLint setup commits. You add to that branch â€” do not rebase onto master.
- `projectService: true` is already enabled in the parser config â€” the rule needs type info, and you have it.

## Step-by-step

### Step 1 â€” Verify the rule (and fix it if Haiku's version is incomplete)

Read [eslint.config.js](../../eslint.config.js). The rule should look approximately like:

```js
"@typescript-eslint/naming-convention": [
  "error",
  {
    selector: "variable",
    types: ["boolean"],
    format: ["camelCase"],
    prefix: ["is", "has", "should", "can", "will", "did", "does"],
  },
  {
    selector: "parameter",
    types: ["boolean"],
    format: ["camelCase"],
    prefix: ["is", "has", "should", "can", "will", "did", "does"],
    leadingUnderscore: "allow",
  },
  {
    selector: "property",
    types: ["boolean"],
    format: ["camelCase"],
    prefix: ["is", "has", "should", "can", "will", "did", "does"],
  },
]
```

If Haiku's version covers fewer selectors, expand it. If it covers the same selectors, leave it. Commit your fix (if any) as `fix(eslint): expand naming-convention rule to cover params and properties`.

### Step 2 â€” Find the violations in server

Run scoped lint to see only server violations:

```bash
yarn dlx eslint packages/server/ --no-warn-ignored 2>&1 | tee /tmp/wbn-a-violations.txt
```

Read the output. Count the violations. The list becomes your work queue.

### Step 3 â€” Rename, one violation at a time

For each violation:

1. Identify the boolean variable / param / property.
2. Choose the natural prefix (`is` for state, `has` for possession, `should` for intent, `can` for capability, `will` for future action, `did` for past action, `does` for predicate).
3. Rename **all references** in the file. If the name is exported or otherwise referenced across files, rename references in those too â€” use `grep` / `Grep` tool to find them.
4. If the boolean is a function parameter named something descriptive that doesn't fit the prefixes (e.g., `enabled`, `recursive`), rename to `isEnabled`, `isRecursive`. Avoid forced contortions â€” sometimes a parameter is really a `state` or `mode` enum in disguise; if so, file a TODO for follow-up rather than slap a prefix on it. The pre-push gate must still pass.
5. **Do NOT rename:**
   - Properties of external types (DOMRect.x, third-party SDK fields, etc.) â€” exempt via `leadingUnderscore` or `filter` in the rule config if it bites.
   - JSON property names sent over the wire â€” those are protocol, not internal. If the rule flags them, narrow the rule's `selector` to exclude `property` for `*.json.ts` files or for response/request type files.
   - Test data fixtures â€” if a fixture uses `enabled: true` to mock external input, leave it.

### Step 4 â€” Pre-push gate (server-scoped)

Universal Rule #2 normally requires `yarn lint` for the whole repo. Since web violations exist (intentionally) and would fail the whole-repo gate, use the scoped gate:

```bash
yarn workspace @mux-magic/server run typecheck
yarn workspace @mux-magic/server run test     # if server has its own test script; otherwise run from root
yarn dlx eslint packages/server/ --max-warnings=0
```

All three must pass. Do not push if any fail.

### Step 5 â€” Commit cadence

Don't commit one rename at a time â€” that's 50+ commits. Instead group by logical area:

- `refactor(server/api): rename booleans to is/has prefix`
- `refactor(server/cli): rename booleans to is/has prefix`
- `refactor(server/tools): rename booleans to is/has prefix`
- `refactor(server/<feature>): rename booleans to is/has prefix`

Each commit should leave server-scoped lint green for that subtree. Push after each commit.

### Step 6 â€” When server is fully clean

Add a note to a new file `docs/boolean-rename-prompts/wbn-a-report.md` summarizing:

- Number of renames
- Patterns observed (mostly parameters? exports? a single offender file?)
- Any rule-config tweaks you made and why
- Anything you flagged with a TODO instead of renaming, and the reason

## Forbidden (Universal Rule #4)

No snapshot tests. No screenshot tests. Test changes use inline assertions.

## When done

Reply with:
- Total renames + commit count
- Rule-config tweaks made (or "none â€” Haiku's version was correct")
- Anything left flagged for follow-up
- Confirmation that `yarn dlx eslint packages/server/` is fully green
- Server typecheck + test results
