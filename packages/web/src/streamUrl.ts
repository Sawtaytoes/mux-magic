import { apiBase } from "./apiBase"

// Build the seekable HTTP-Range URL the server's /files/stream route
// serves at packages/api/src/api/routes/fileRoutes.ts:458-556. Used by
// every in-browser preview modal (video, audio, image). Lifted out so
// the URL shape (and encoding rules) live in one place.
export const streamUrl = (path: string): string =>
  `${apiBase}/files/stream?${new URLSearchParams({ path })}`
