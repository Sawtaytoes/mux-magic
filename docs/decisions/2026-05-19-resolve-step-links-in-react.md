# 2026-05-19 — React components must resolve step links, not just `params`

- **Status:** Accepted
- **Date decided:** 2026-05-19
- **Area:** web
- **Source:** commits `7b864655`, `56981f93`; memory `feedback_resolve_links_in_react.md`

## Decision

When a React component reads a field off a step, it must read **both** `step.params[field]` **and** the linked-variable value via `step.links?.[field]` (use `getLinkedValue` from `packages/web/src/commands/links.ts`). `params` is empty for any field the user has bound to a Variable, so params-only reads see nothing for those users.

## What we rejected — DO NOT revert to this

Do not read `step.params[field]` directly and branch on it. It looks correct and it typechecks, but it silently gates the component off for anyone using the linked-variable pattern — exactly the two invisible-UI bugs fixed in `7b864655` and `56981f93` (a component hid itself, and unrenamed NSF files failed to surface, whenever `sourcePath` was variable-linked).

## Why it must not be re-litigated

The bug only appears at runtime, only for linked-variable users, and never in a typecheck or a test that sets `params` directly. An agent "simplifying" a `getLinkedValue` call back to `step.params[x]` re-introduces a class of silent UI dropouts. See also [sourcePath is canonical](2026-05-12-sourcepath-canonical-field-name.md).
