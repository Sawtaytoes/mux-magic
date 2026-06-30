# 2026-05-08 — Auto-merge PRs when tests + self-check pass

- **Status:** Accepted
- **Date decided:** 2026-05-08 (date captured in memory; a standing preference from the media-tools era — may predate this)
- **Area:** process
- **Source:** memory `feedback_auto_merge.md` (media-tools-era project folder)

## Decision

Open **and merge** a PR immediately when: tests pass, the build is clean, and the AGENTS.md pre-PR grep self-check is clean. Don't surface it for approval first — the user reviews by pulling the branch and exercising the feature.

## What we rejected — DO NOT revert to this

Do not hold a clean PR "waiting for review." User: *"Any PR coming, just make it and merge it. I don't need to see it until I pull it down to test."* The cautious instinct to wait for a human ✅ has been explicitly delegated away **for the passing case**.

## Why it must not be re-litigated

This is a deliberate workflow choice that keeps the parallel-worker pipeline moving. **Still ask** (do NOT auto-merge) when: tests fail or were skipped, the self-check fails, the lint/CI gate is red, or scope expanded beyond the task. Those exceptions are the boundary — auto-merge is for the genuinely-green case only.
