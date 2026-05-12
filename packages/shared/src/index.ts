// Public entry for @media-tools/shared. THIS IS THE ONLY ALLOWED BARREL FILE
// in the entire repository — see AGENTS.md "Module exports — no barrel files".
// It exists because external consumers (the media-sync sibling repo, plus any
// future npm consumers) need a single stable import path; without it every
// release would re-publish the package's internal file layout into consumer code.
//
// Inside this monorepo, never import from "@media-tools/shared" — import the
// individual file directly (e.g. "@media-tools/shared/src/naturalSort").

export { naturalSort } from "./naturalSort.js"
