# 2026-05-07 — Architecture choices: one stable recommendation; minimize npm deps

- **Status:** Accepted
- **Date decided:** 2026-05-07 (date captured in memory; a standing preference from the media-tools era — may predate this)
- **Area:** process
- **Source:** memory `feedback_architecture_tradeoffs.md`, `user_dependency_preference.md` (media-tools-era project folder)

## Decision

When presenting an N-option architecture decision: give a **parallel side-by-side comparison** and **one honest recommendation** tied to the user's actual context, then hold it. Treat the **npm-dependency count as a first-class trade-off** — the user routinely flips a design specifically to avoid adding a dependency, and prefers vanilla `fetch` / built-ins over a library when it's close.

## What we rejected — DO NOT revert to this

- Do not equivocate or silently shift your recommendation across turns. The AI once flip-flopped twice on a 1-vs-2-endpoint webhook decision; user: *"it sounds like you changed your mind."* Pick one, say why, and stay unless new facts arrive.
- Do not default to pulling in a library when a built-in works. In the Home Assistant integration, the user chose the webhook approach over MQTT explicitly because *"No npm dependencies!"*

## Why it must not be re-litigated

Wobbling recommendations and reflexive dependency-adding both erode trust and produce designs the user then has to walk back. The dependency-aversion is a real, repeated decision driver — weigh it explicitly, every time.
