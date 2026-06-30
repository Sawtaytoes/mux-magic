# 2026-05-07 — "Update AGENTS.md" means the reference docs; keep the index slim

- **Status:** Accepted
- **Date decided:** 2026-05-07 (earliest capture in memory; a standing docs-structure preference — may predate this)
- **Area:** process
- **Source:** memory `feedback_agents_md_discipline.md` (2026-05-07), later `feedback_agents_md_means_reference_docs.md` (2026-05-16); [AGENTS.md](../../AGENTS.md)

## Decision

`AGENTS.md` is a **slim index**. New rules and conventions go into focused topical files under `docs/agents/*.md` (and settled decisions into `docs/decisions/`). Prefer several small topical docs over one growing reference. When the user says "add this rule to AGENTS.md," that means: add it to the right reference doc and, if needed, add/adjust an index row in AGENTS.md.

## What we rejected — DO NOT revert to this

Do not stuff rule bodies into `AGENTS.md` itself. It loads into **every** conversation, so growing it bloats every session's context. An agent told "update AGENTS.md" will literally append paragraphs to AGENTS.md — don't; route the content to a reference doc instead.

## Why it must not be re-litigated

This is the reason the repo's guidance is structured as index + `docs/agents/` + `docs/decisions/` in the first place. Collapsing rules back into AGENTS.md re-bloats the always-loaded file and undoes the deliberate split.
