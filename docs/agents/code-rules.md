# Code Rules & Conventions

Guidelines for writing code in this repository. These rules apply to **every** source file: TypeScript, modern JS, and the plain `<script>`-tag JS in `public/**`. There is no "this is a small browser JS file, the TS rules don't count" exception. `public/format-bandwidth.js`, `public/jobs/job-card.js`, `src/**/*.ts` — same rules. Don't pattern-match off file extension; pattern-match off "is this source code in this repo."

## The Four Most-Violated Rules

1. **No `for` / `for...of` / `while` loops over arrays.** Use `forEach` / `map` / `filter` / `reduce` (or `concatMap` / `mergeMap` in observable code). C-style `for (let i = 0; ...)` and `for (const x of arr)` are both banned.
2. **`const` only. No `var`. No `let` mutation.** If you reach for `let` to accumulate a value, you want `reduce` or `map`. `var` is banned outright — `public/**.js` runs in modern Chrome, there's no hoisting excuse.
3. **Spell every variable name out.** Single letters (`i`, `h`, `m`, `s`, `c`, `el`) and 2-3 letter abbreviations (`bps`, `idx`, `ctx`, `opts`, `dest`, `src`, `val`, `err`) are banned. Use `index`, `hours`, `minutes`, `seconds`, `context`, `element`, `bitsPerSecond`, `options`, `destination`, `source`, `value`, `error`.
4. **Booleans must start with `is` or `has`.** Function params, object properties, schema fields, CLI flags, local variables — all of them. `deleteSourceOnSuccess` is wrong; `isSourceDeletedOnSuccess` is right. `useDefaultRules` is wrong; `hasDefaultRules` is right. The prefix tells a reader at a glance that the value is yes/no, not a string or function. Matches the existing `isRecursive` / `hasChapterSyncOffset` / `hasFirstAudioLanguage` patterns.

## All Nine Rules

5. **Function arguments: single destructured object, not positional.** Any function that takes 2+ arguments uses a single object parameter with destructuring. `mountLogsDisclosure(parent, jobId, status)` is wrong; `mountLogsDisclosure({ parent, jobId, status })` is right. Callers pass `{ parent, jobId, status }`. Reasons: argument order doesn't matter at the call site, params are self-documenting, dropping/adding/renaming a param doesn't reshuffle every caller. Single-arg functions stay as-is (`getMediaInfo(filePath)`); the rule only kicks in at 2+. Existing positional functions are not retroactively required to change, but any function you create or whose signature you modify must follow this.

6. **Always brace `if` / `else` / `for` / `while`.** Even for early returns and one-liners. `if (!x) return null` is wrong; only the multi-line braced form is allowed.

7. **`const` + arrow functions only — no `function` declarations.** `function loadYaml(text) { ... }` is wrong; `const loadYaml = (text: string) => parse(text)` is right. The only exception is when `this` binding is explicitly required (essentially never in this codebase — hooks, event handlers, and utilities all close over the outer scope). React components are arrow functions too: `const LoadModal = () => (<div>...</div>)`, not `function LoadModal() { ... }`.

8. **Implicit returns only — never write the `return` keyword in production code.** When an arrow function returns a value, the body is the expression itself, wrapped in `()` for multi-line grouping. The canonical shape:

   ```ts
   const handle = (request) => (
     request.json()
   )
   ```

   Not `(request) => { return request.json() }`, not `(request) => { return request.json(); }`. Multi-step logic uses promise chains (`.then` / `.catch`), ternaries, `&&` / `||`, and `()` grouping — never a `{ return ... }` block.

   Side-effect-only callbacks (no return value at all) are written as `() => { doSomething() }` and are fine — there's no `return` keyword in that form, so the rule isn't engaged. The rule is specifically: when you have a value to return, return it as the expression, not via the `return` keyword.

   The single allowed exception is `return` inside test bodies (`it("name", async () => { ... })`), where bodies are imperative `expect(...)` sequences. Outside tests, search your diff for `return ` and fix every hit.

9. **No barrel files.** No `index.ts` or `index.css` re-export files inside component, state, util, or icon folders. Import each module by its full path: `import { LoadModal } from "./components/LoadModal"`, not `from "./components"`. The single allowed barrel is `packages/tools/src/index.ts`, which exists only because `@mux-magic/shared` is published to npm and consumers need a stable public entry point. Enforced by `import-x/no-barrel-files` in `eslint.config.js`.

## Before Opening a PR — Self-Check Your Diff

The agents have repeatedly violated rules 1–4. Before you announce a PR, search your diff (`git diff master...HEAD -- '*.ts' '*.js' '*.mjs'`) for these literal substrings, and fix every hit:

| Search for | Means you violated |
|------------|--------------------|
| `for (` or `for(` | rule 1 |
| `for ... of` (in your additions) | rule 1 |
| `var ` (with trailing space) | rule 2 |
| `let ` followed by reassignment of the same name later | rule 2 |
| Single-letter loop counters / accumulator names | rule 3 |
| Boolean field/var without `is`/`has` prefix (added in your diff) | rule 4 |
| New/modified function signature with 2+ positional params (instead of single destructured object) | rule 5 |
| `if (` on a line whose closing `)` is followed by anything other than ` {` | rule 6 |
| `^function ` or `^export function ` (lines starting with `function`) | rule 7 |
| `return ` keyword in your additions (outside test files) | rule 8 (use `() => (expression)` instead) |
| Import path ending in a folder rather than a file (`from "./components"`, `from "../state"`) | rule 9 |
| Multi-paragraph JSDoc blocks (`/** ... */` over more than one short line) | over-commenting (default: no comments — see "Doing tasks" guidance) |

Workers that ship code containing any of the above will get the PR sent back. Catch it yourself first.

## Variable Naming

- No single-letter variable names. Always use descriptive names that convey purpose.
- No two- or three-letter abbreviations either (e.g. `lv`, `pv`, `el`, `msf`, `idx`). Spell the word out — `linkedValue`, `pathVar`, `element`, `mainSourceField`, `index`.
- Hono route handler context: use `context` (not `c`). Example: `app.get("/", (context) => context.json({}))`.
- Spell out all abbreviations in variable names (e.g. `destination` not `dest`, `source` not `src`, `options` not `opts`, `value` not `val`, `error` not `err`, `response` not `resp`).
- Function names take an action verb; variables hold the noun the function returns. `linkedVal` is wrong on two counts — it abbreviates `Value`, and as a function it should describe the action: `getLinkedValue` is the function, and the variable that captures its result is `linkedValue`.
- **Booleans must start with `is` or `has`.** This includes function parameters, object properties, schema fields, CLI flags, and local variables. `deleteSourceOnSuccess` is wrong — `isSourceDeletedOnSuccess` reads as a question and matches the existing `isRecursive` / `hasChapterSyncOffset` / `hasFirstAudioLanguage` patterns. The prefix tells a reader at a glance that the value is yes/no, not a string or function.

## Coding Style

- Functional style; prefer `concatMap` / `mergeMap` over imperative loops
- For iterating arrays, use functional methods (`forEach`, `map`, `filter`, `reduce`, etc.) instead of `for...of` loops
- Imports sorted alphabetically within each group
- Observable pipelines broken across lines (see existing modules for reference)
- Always use multi-line braced `if` bodies, even for early returns and one-liners. Don't write `if (!cmd) return null` — write:

  ```ts
  if (!cmd) {
    return null
  }
  ```

  Same rule for `else`, `for`, `while`. The brace cost is one line; the safety against silent edit mistakes (adding a second statement that quietly falls outside the conditional) is worth it.

- **Prefer positive conditions over negative ones.** Structure logic to check for the positive case first, avoiding the `!` operator when possible. A positive condition reads more naturally than a negation.

  ```ts
  // WRONG — double negative
  const pct = !isIndeterminate
    ? `${(Math.max(0, Math.min(1, ratio as number)) * 100).toFixed(1)}%`
    : null

  // RIGHT — positive condition
  const pct = isIndeterminate
    ? null
    : `${(Math.max(0, Math.min(1, ratio as number)) * 100).toFixed(1)}%`
  ```

  This applies to ternaries, `if`/`else` statements, and conditionals generally. When the condition is naturally negative (`!isFound`, `!hasData`), still structure your logic so the positive case (where you do something) comes first.

## Function Style (Arrow Functions, Implicit Returns)

All functions in this codebase are `const` + arrow functions. The `function` keyword is reserved for the rare case where a `this` binding is genuinely required — that case hasn't come up in this repo yet, and almost certainly won't come up in React code either (hooks, event handlers, and utilities all close over the outer scope, and JSX components do not need their own `this`).

**Implicit returns are mandatory: never write the `return` keyword.** When a function returns a value, the body *is* that value as an expression, wrapped in `()` for grouping when it spans multiple lines. The canonical shape:

```ts
const handle = (request) => (
  request.json()
)

const flattenSteps = (steps: Step[]) => (
  steps.flatMap((step) =>
    isGroup(step) ? step.children : [step]
  )
)

const loadYaml = (text: string) => parse(text)
```

These are wrong because they use the `return` keyword:

```ts
// WRONG — function declaration
function loadYaml(text) {
  return parse(text)
}

// WRONG — block body with return
const loadYaml = (text: string) => {
  return parse(text)
}

// WRONG — async with return
const fetchJobs = async () => {
  const response = await client.GET("/jobs")
  return response.data
}
```

Async returns are still implicit — chain them through Promises:

```ts
// RIGHT
const fetchJobs = () => (
  client.GET("/jobs").then((response) => response.data)
)
```

Side-effect-only callbacks (no value to return) keep the `{ ... }` form because there's no `return` keyword involved at all:

```ts
// fine — nothing being returned, no `return` written
.then(() => {
  console.log("Updated schemas.")
})
```

The single allowed place for the `return` keyword is **inside test bodies** — `it("name", async () => { ... })` blocks are imperative `expect(...)` sequences and occasionally need an early `return` for guard conditions. Outside tests, search your diff for `return ` and rewrite every hit as an expression.

If a non-test function feels like it "needs" `return`, the rewrite usually exists: ternaries, `&&` / `||`, optional chaining, promise chains (`.then` / `.catch`), and `()` grouping cover virtually every case. When the rewrite is genuinely awkward, that's a signal to split the function into smaller pieces, each of which *is* an expression.

## Module Exports — No Barrel Files

There are **no `index.ts` re-export files** inside component, state, util, hook, or icon folders. Import every module by its full path:

```ts
// WRONG
import { LoadModal } from "./components"
import { stepsAtom, pathsAtom } from "./state"

// RIGHT
import { LoadModal } from "./components/LoadModal"
import { stepsAtom } from "./state/stepsAtom"
import { pathsAtom } from "./state/pathsAtom"
```

The single allowed barrel in the entire repo is `packages/shared/src/index.ts`. It exists because `@mux-magic/shared` is published to npm and external consumers need a stable import surface — without that one barrel, every consumer would have to know the package's internal file layout. Inside the monorepo, no such barrier exists; full paths keep imports honest, make dead code visible to bundlers, and prevent the "import the whole folder to get one thing" pattern that hides accidental coupling.

Enforced by `import-x/no-barrel-files` in `eslint.config.js`.
