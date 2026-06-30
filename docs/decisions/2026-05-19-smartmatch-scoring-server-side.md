# 2026-05-19 — Smart Match scoring runs server-side; no client scorer

- **Status:** Accepted
- **Date decided:** 2026-05-19
- **Area:** core / web
- **Source:** worker 25, commits `0d25162b` (port to server), `70a9db7a` (delete client scorer)

## Decision

Special-feature candidate ranking lives **server-side** in core (`rankCandidates` + `applyOrderBonus` tie-break). The server emits a pre-ranked payload; the Smart Match modal is a **pure presenter** that renders those scores verbatim. Duration-weighted ranking (`DURATION_WEIGHT = 0.7`, low-confidence threshold `0.6`) and the order-based tie-break (+0.05 when file index matches the DVDCompare order index — small enough not to override duration evidence) are computed once, on the server, per run.

## What we rejected — DO NOT revert to this

The client-side `smartMatchScoring.ts` and its 23-test suite were **deleted**. Do not re-add client-side ranking "to avoid a round-trip" or "to make the modal feel snappier." Scores are deterministic per run and must survive a browser refresh, so they belong with the filesystem-backed run state, not in volatile component state.

## Why it must not be re-litigated

Client-side scoring is lost on refresh — the exact failure the centralization fixed. Ranking is part of NSF's crash-recoverable, filesystem-backed model (see [NSF state lives in the filesystem](2026-05-19-nsf-filesystem-is-the-state.md)). Recomputing in the browser re-opens the refresh-loses-state bug.
