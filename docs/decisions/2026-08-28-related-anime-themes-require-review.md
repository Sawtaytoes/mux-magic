# 2026-08-28 — Related anime themes require review

- **Status:** Accepted
- **Date decided:** 2026-08-28
- **Area:** core / cli
- **Source:** Owner chat, 2026-08-28

## Decision

Only an AnimeThemes result for the exact AniDB ID can be planned or applied automatically. An AniDB Parent Story or Prequel relation can produce a review candidate, but it must never write `theme.mp3` without an explicit approved mapping.

## What we rejected — DO NOT revert to this

Do not treat an AniDB relation, a similar title, or a shared franchise as proof that two folders use the same theme. In particular, do not give the original *Toward the Terra* (AniDB 1416) the 2007 television series theme from AniDB 5039.

## Why it must not be re-litigated

Related anime can have different stories, timelines, formats, and music. A missing theme is preferable to a confidently wrong theme. Review candidates retain useful evidence for cases such as an OVA that genuinely reuses a parent show's song, while protecting distinct works from accidental replacement.
