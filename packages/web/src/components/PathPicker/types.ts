// Types for the path autocomplete — the typeahead that lists directory
// entries returned from the server's /files endpoint, now built on
// charcuterie's Combobox (attached-input mode) via `usePathAutocomplete`.
//
// DirEntry is defined server-side (shared API contract for /files); the
// path autocomplete is the only feature that consumes it.

import type { DirEntry } from "@mux-magic/api/api-types"

export type { DirEntry }
