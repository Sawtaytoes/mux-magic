import {
  createApiClient,
  createApiHooks,
} from "@charcuterie/logic/query"

import { apiBase } from "../apiBase"
import type { paths } from "./schema.generated"

// The single blessed HTTP seam for the web app: a `paths`-typed
// `openapi-fetch` client (generated from the API's live OpenAPI
// document into ./schema.generated.ts) bound to TanStack Query via
// `@charcuterie/logic/query`. Every data call should reach the server
// through `api.useQuery` / `api.useMutation` here — path, params, and
// body are all inferred from the generated schema, so a route rename
// on the server surfaces as a type error at the call site.
//
// `baseUrl` is `apiBase` ("/api") — the same-origin front door that
// hosts both the SPA and the API — so path keys stay unprefixed
// (`/system/threads`, not `/api/system/threads`).
const fetchClient = createApiClient<paths>({
  baseUrl: apiBase,
  // Late-bind the global `fetch` rather than let openapi-fetch capture
  // it once at client-creation (module-import) time. Production is
  // unaffected — it still calls `globalThis.fetch` — but a test that
  // stubs `fetch` after this module has loaded (every browser-mode card
  // test does) now reaches the stub instead of the real network.
  fetch: (...args) => globalThis.fetch(...args),
})

export const api = createApiHooks(fetchClient)
