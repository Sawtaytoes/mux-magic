# Variable types — backlog & ideas

The sequence-builder Variables system ([docs/agents/variables-system.md](../agents/variables-system.md)) registers typed, named variables. New types register via the type registry (worker 36); adding one is small — worker 45 registered three in a batch by copy-pasting the existing ID-type pattern.

This file is the durable home for "variable types we might add." If you remember an idea, write it under **Your ideas** so it isn't lost again.

## Registered today

| Type | Holds | Cardinality | Lookup-backed? |
| --- | --- | --- | --- |
| `path` | filesystem path | multi | file picker (📁 on the card) |
| `dvdCompareId` | DVD Compare film id (slug or URL) | multi | DVD Compare — *search button missing on the card, see handoff item R* |
| `threadCount` | per-sequence execution thread cap | singleton | no |
| `tmdbId` | TheMovieDB id | multi | TheMovieDB |
| `anidbId` | AniDB id | multi | AniDB |
| `malId` | MyAnimeList id | multi | MyAnimeList |

## Recoverable future ideas (from the docs trail)

- **`imdbId`** — IMDb id (numeric or imdb.com URL). Named in [worker 45](45_id-variable-types-and-field-link-awareness.md) as the canonical "future fourth ID type"; registering it mirrors `tmdbId`/`anidbId`/`malId` exactly.
- **`tvdbId` (TheTVDB)** — series/episode id; only *loosely* implied by [worker 1f](1f_mux-magic-anime-manga-commands.md)'s "TheTVDB integration" note. Not yet a committed proposal.

## Searched but NOT found written down

A sweep of the chat transcripts + memory files (2026-06-30) found **no** written list of additional variable-type ideas beyond the above. The user recalls having more ideas "in the past"; they were likely spoken in an uncaptured session or never written. (ISBN / MusicBrainz / IGDB appeared in the search only as false positives inside base64 screenshot data — not real mentions.)

## Cross-population of linked ID variables (idea)

You shouldn't have to configure `tmdbId` by hand when a `dvdCompareId` is already present — it can be **derived**. The "Open on TheMovieDB" link already does this: `resolveTmdbForBaseTitle` (`packages/web/src/components/NumberWithLookupField/runReverseLookup.ts:126-161`) turns the DVD-Compare-resolved title+year into a `{ tmdbId, tmdbName }`. The idea: when you look up one ID, auto-populate a *linked* variable that can be derived from it — **one-directional**: `dvdCompareId → tmdbId` works, but `tmdbId → dvdCompareId` doesn't (no reverse mapping). Tracked as **handoff item S**; prior art is workers 35 (reverse-lookup) and 45 (field↔variable link-awareness).

### The title is derivable too (not just the id)

The same DVD Compare → TheMovieDB lookup grabs the **title** (`tmdbName`, e.g. `Muppets Most Wanted (2014)`), so the resolved title can be a linkable value usable as a folder name elsewhere. Tracked as **handoff item U**.

## Variable composition (variables referencing variables) — not supported yet

Variables hold literal values; one variable can't reference another. To use a derived title *inside* a path variable (e.g. `<library>/${movieTitle}`), the system needs **variable composition** — resolving `${otherVariable}` / `@id` inside a variable's own value. Today's `${...}` interpolation (worker 6d) runs only on step params at run time, not on variable values. This is foundational and currently missing. Tracked as **handoff item V**.

## Your ideas (add here)

*Capture remembered or new variable-type ideas here — name, what it holds, and whether it's lookup-backed. Each can later become a registry entry like worker 45 (and, if lookup-backed, should ship with the card search button from handoff item R).*

- *(empty)*
