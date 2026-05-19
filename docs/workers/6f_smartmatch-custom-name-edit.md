# Worker 6f — SmartMatch custom-name edit (✏ button)

**Status:** ready
**Track:** web
**Model:** Sonnet
**Effort:** Medium
**Thinking:** ON
**Depends:** 58 (SmartMatch port), 60 (v1 feature-parity audit)

## Why

The legacy v1 SmartMatch / "Fix Unnamed" modal had a ✏ pencil button on each row that let the user **type a fully custom name** for the leftover file instead of picking from the DVDCompare candidate dropdown. Worker 58 ported the modal but explicitly deferred the pencil-edit affordance ("intentionally leaner than the legacy: the ✏-custom-name input and Plex-suffix selector that legacy added as nice-to-haves are deferred to a follow-up" — see [SmartMatchModal.mdx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.mdx)).

The current state — after worker 56981f93 augmented the modal to render a free-text input when `rankedCandidates` is empty — partially covers the gap but only for the zero-candidates path. When candidates DO exist, the user is locked into the dropdown. Real-world cases where the user wants to type a custom name even when candidates exist:

- **DVDCompare's published name has a typo / inconsistent quoting** — e.g. the page lists `Shrek the Musical "I Know It's Today"` with smart-quotes that Plex chokes on; the user wants to type the clean version `Shrek the Musical I Know It's Today` directly.
- **The file is a Plex-aware variant the user wants to tag** — e.g. `Director's Commentary -other` instead of the candidate `Director's Commentary`. (Plex suffix tagging is the Plex-suffix selector legacy also had.)
- **DVDCompare missed an extra entirely** — the user knows from the disc menu that the file is a specific featurette; none of DVDCompare's candidates match; they want to type the name they know.
- **None of the candidates are even close** — the file is something DVDCompare doesn't enumerate and the user wants a fresh name.

## What

Add a pencil-edit (`✏`) toggle on each SmartMatch row. Toggling it swaps the row's "Rename to" cell from the [`RenameTargetPicker`](../../packages/web/src/components/SmartMatchModal/RenameTargetPicker.tsx) styled select to a text input — same input the zero-candidates branch in [SmartMatchModal.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx) already renders. Toggling back returns to the picker, keeping whatever was typed available in the input on next toggle.

Pre-populate the text input with the currently-selected candidate name so the user can edit from a starting point instead of typing from scratch.

Stretch goal (defer to a worker 7x follow-up if this one balloons): a per-row Plex-suffix dropdown (`-featurette` / `-trailer` / `-deleted` / `-behindthescenes` / `-interview` / `-scene` / `-short` / `-other`) that appends to the typed/picked name on apply.

## Out of scope

- The Plex-suffix selector — defer to a follow-up worker (the legacy combination has too many UX questions: does suffix selection persist across the run? does it apply to candidate picks too? what happens when DVDCompare's candidate already has a `-tag` suffix?).
- A "save this manual name as a candidate" affordance — the modal doesn't write back to DVDCompare and shouldn't pretend to.
- Bulk-edit across rows — every row is independent.

## Files

- [packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.tsx) — add `isEditing` to `RowState`, render ✏ toggle + conditional input/picker in the "Rename to" cell.
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.test.tsx) — add a test that toggling ✏ swaps in a text input and the typed name is the one POSTed on apply.
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.stories.tsx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.stories.tsx) — add a story that renders one row mid-edit so the visual is reviewable.
- [packages/web/src/components/SmartMatchModal/SmartMatchModal.mdx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.mdx) — remove the "intentionally leaner / deferred to follow-up" line since this worker resolves it.

## Acceptance

- Each unrenamed row in SmartMatchModal shows a `✏` toggle next to the "Rename to" cell.
- Clicking `✏` swaps the picker for a text input pre-filled with the current row value; clicking again swaps it back, retaining whatever was typed.
- The Apply button uses the visible cell's value (typed text OR picked candidate) for the rename POST.
- Test coverage as listed above.
- Storybook story for the mid-edit state.

## Notes

The previous deferral lived in [SmartMatchModal.mdx](../../packages/web/src/components/SmartMatchModal/SmartMatchModal.mdx) at the "Worker 58 / Part B" notes — when closing this out, drop that line as the deferral is no longer applicable.
