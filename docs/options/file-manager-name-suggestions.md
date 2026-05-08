# File-Manager Name Suggestions

## User Question

> "Is there a way to show a list of possible options that I could name files in the file manager view? Is this even a good idea?"

---

## What This Would Mean

When a user opens the file manager view and sees a file (e.g. `MOVIE_t23.mkv`) that has not been renamed yet, the product would surface a short list of name candidates directly inside the UI — so the user can pick one rather than having to type a full name from scratch.

The candidates would come from the same DVDCompare scrape the rename pipeline already performs: specifically the `possibleNames` / untimed entries (e.g. "Image Gallery", "Storyboard", "Deleted Scene") that the pipeline can't assign by timecode alone.

---

## Option A — Right-Click / Context Menu

**How it works.** The user right-clicks an unnamed file in the file manager. A context menu appears with up to 5–10 candidate labels pulled from the last `nameSpecialFeatures` result cached in the job store. Selecting one renames the file immediately (or pre-fills a rename input field, requiring one more click to confirm).

**Signal source.** The `unrenamedFilenames` + `possibleNames` payload already lands in the job's SSE result. The UI stores that payload alongside the job so the right-click handler can read it without a new network request.

**Accessibility.** Context menus are keyboard-accessible on desktop (Shift+F10 / Menu key), but mobile has no right-click equivalent — this option only works for pointer users on desktop.

**Mobile.** Not usable as-is. A long-press might be wired up, but that's a separate UX investment.

**Implementation cost.** Low on the backend (payload is already there). Medium on the frontend: the file manager needs a context-menu component and a way to associate the open job's candidate list with the currently-displayed directory.

---

## Option B — Inline Dropdown Next to the Filename

**How it works.** Each unmatched file in the file manager view gets a small "Suggest a name" button or chevron next to its filename. Clicking it expands an inline dropdown that shows the candidate list. The user clicks a candidate and the file is renamed (or staged for rename).

**Signal source.** Same as Option A — the job's cached `possibleNames` list. A smarter version could also run a lightweight prefix-similarity filter so the dropdown shows the candidates most lexicographically close to the raw filename (already implemented in `buildUnnamedFileCandidates` on the backend).

**Accessibility.** Inline controls are fully keyboard-accessible. This is the most accessible of the three options.

**Mobile.** Works — tap to expand the dropdown. No special gesture required.

**Implementation cost.** Medium: requires a collapsible inline UI element per unmatched row, plus connecting the job-result payload to the per-file row state. The backend already surfaces the ranked candidate list (`unnamedFileCandidates`) in the summary event.

---

## Option C — Sidebar Candidate Panel Driven by DVDCompare Lookup

**How it works.** A persistent sidebar (or collapsible drawer) shows all untimed DVDCompare suggestions for the current directory's active job. The user drags a suggestion from the sidebar onto a file row (or selects the file row and then clicks a sidebar item) to rename.

**Signal source.** Same job result payload — but the sidebar can also re-fetch suggestions by triggering a fresh DVDCompare search if the user loads a directory that was never processed, making the panel more general-purpose.

**Accessibility.** Drag-and-drop is not accessible. A "click file row, then click sidebar item to apply" fallback is needed for keyboard users.

**Mobile.** Drag-and-drop is hard on mobile. Touch-tap fallback works, but the sidebar takes up significant screen real estate.

**Implementation cost.** High: sidebar layout, drag-and-drop plumbing, fallback click-to-assign, re-fetch logic.

---

## Honest Recommendation

**Yes, the feature is worth it — use Option B (inline dropdown).**

The pain point is real: after `nameSpecialFeatures` runs, the user already has the candidate list printed to the log, but has no convenient way to act on it inside the UI. The backend already computes ranked candidates in `buildUnnamedFileCandidates` and emits them in the summary SSE event. An inline dropdown directly on the unmatched-file row turns that existing data into an actionable UI without any new network calls.

Option A (right-click) is easier to implement but excludes mobile and touch users. Option C (sidebar) is overbuilt — the signal source is a flat list of suggestions, not a rich drag-friendly dataset.

If scope is tight, **a simpler first step** is even easier: display the `unnamedFileCandidates` list underneath the "Files not renamed:" section in the Results panel as a readable "Possible names" hint (the CLI already does this). That alone closes most of the UX gap with zero new UI components.

---

## Open Questions for the User

1. **How many unnamed files do you typically end up with per run?** If it's usually 1–2, a simple hint in the Results panel might be sufficient. If it's 5+, an interactive inline picker becomes much more valuable.

2. **Do you want the rename to happen immediately when you pick a candidate, or would you prefer a "stage and confirm" step?** Immediate rename is faster; confirm step prevents accidental renames.

3. **Is mobile/tablet a meaningful use case for the file manager view?** This affects whether Option A (desktop-only) is acceptable.

4. **Should the candidate list be static (from the last job result) or should the UI be able to re-fetch suggestions by re-running a DVDCompare lookup?** Static is simpler; re-fetch is useful if the directory changes between runs.

5. **Does the user want to type a fully custom name when no candidate fits?** If so, the dropdown should include a "Custom…" entry that opens a text input, which keeps it consistent with the picker rather than requiring the user to find a separate rename control.
