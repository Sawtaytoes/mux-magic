# 2026-08-21 — Hide `exited` jobs by default, and lay the jobs view out as a grid

- **Status:** Accepted
- **Date decided:** 2026-08-21
- **Area:** web
- **Source:** [PR #243](https://github.com/Sawtaytoes/mux-magic/pull/243) · owner chat 2026-08-21

## Decision

1. The Jobs view **hides `exited` by default**. Every status is a toggleable chip in
   `JobStatusFilter`; the set is remembered in `localStorage`.
2. `/jobs/stream` takes `?status=` and leaves hidden statuses out of the **connect
   replay** — but **always streams live updates**, whatever their status.
3. The Jobs view is a **responsive grid** (`AdaptiveGrid` from `@charcuterie/ui`), and the
   page carries **no fixed max width**.

## What we rejected — DO NOT revert to this

**Do not put `exited` back in the default set.** It is a planned early exit
(`exitIfEmpty` and friends), and a sequence that finds nothing to do writes one umbrella
job plus one per remaining step. The owner's workspace had **3,412** of them against 25
jobs that did something:

> "Can I hide all 'exited'? I'd like to only show them via an option but hide by default
> because they're basically useless, and there are thousands of them."

**Do not "simplify" the two filters into one.** There is a filter on the server (the
replay) and a filter in `JobsList` (the render), and dropping either one breaks something:

| Drop | Breaks |
| --- | --- |
| the server's | Thousands of hidden jobs are parsed by the browser on every page load — 1.2 MB of JSON on the fixture workspace. This is the bug the PR exists to fix. |
| the client's | Nothing, until a job transitions *into* a hidden status while the page is open. |

**Do not extend the server filter to live updates.** It reads as the obvious tidy-up and
is a real bug: the event that would remove a card from the page is exactly the event that
gets dropped, so the card sits there forever showing its last visible status.

**Do not judge a sequence step by its own status.** Steps are only ever rendered inside
the umbrella's disclosure, so a step-level filter punches holes in a visible sequence's
step list. A child is judged by its **parent's** status.

**Do not put a `max-w-*` back on `JobsPage`,** and do not replace `AdaptiveGrid` with an
`auto-fill, minmax()` grid. The cap is what made the grid impossible in the first place —
`AdaptiveGrid` widens its own cap as it takes columns (1 col 56rem → 3 cols 106rem), so an
outer cap only divides one narrow column into narrower ones. `auto-fill` is the thing
`AdaptiveGrid` was written to replace: it takes every column the width allows and strings
seven cards across an ultrawide.

## Why it must not be re-litigated

**The grid is a fleet-wide standing rule, not this app's taste.** It is recorded in the
workspace repo as
`docs/decisions/2026-08-21-lists-of-cards-are-a-grid-not-full-width-rows.md`, and the
reason that file exists is that the owner had been saying it to every agent at the start of
every app and losing it every time:

> "These items are super wide. I tell EVERY agent this when starting a new app to make
> them in a grid. There's no reason to make them this wide. I can't read like that either."

**Two failure modes here are silent, and both were hit while building this.**

- `useAdaptiveColumns`' container ref must be attached on the **first** render. Returning
  the empty state early leaves it unattached, and a ref arriving later does not re-run the
  effect that observes it — so the hook measures an inline size of zero for the life of the
  page and `chooseColumns` caps at one column. No error, no warning, and the page looks
  exactly like the thing you were trying to fix. The measured container therefore renders
  unconditionally, empty state inside it.
- The e2e `page.route("**/jobs/stream")` globs stopped matching the moment the URL grew a
  query string. Five specs went red at once; the fix is `**/jobs/stream*`. Any future
  parameter on that endpoint has the same trap.

**The counts on the chips come from `GET /jobs/status-counts`, not from `jobsAtom`,** and
that is not an accident to be optimised away. The stream is asked not to replay a hidden
status, so the client genuinely does not have those jobs — counting there renders
`exited 0` with thousands on disk. A chip that lies about the thing it is hiding is worse
than one with no number at all.
