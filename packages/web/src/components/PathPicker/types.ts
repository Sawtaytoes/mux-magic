// Types owned by PathPicker â€” the typeahead dropdown that lists
// directory entries returned from the server's /files endpoint.
//
// DirEntry is defined server-side (shared API contract for /files);
// PathPicker is the only feature that consumes it.

import type { DirEntry } from "@mux-magic/server/api-types"

export type { DirEntry }
