import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getDefaultStore, Provider as JotaiProvider } from "jotai"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { LoadModal } from "./components/LoadModal"
import { AppRouter } from "./router"
import { initBridge } from "./state/bridge"
import "./styles/tailwindStyles.css"
import "./styles/builderStyles.css"

// Bridge must run before any React render so that:
//  1. Jotai atoms are seeded with the URL-restored legacy state.
//  2. window.openLoadModal / window.closeLoadModal are live before the
//     legacy HTML's onclick handlers can be triggered.
initBridge()

const queryClient = new QueryClient()
const store = getDefaultStore()

// ─── Main React SPA (packages/web/index.html context) ────────────────────────

const rootElement = document.getElementById("root")
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <AppRouter />
        </QueryClientProvider>
      </JotaiProvider>
    </StrictMode>,
  )
}

// ─── LoadModal (legacy HTML context — transitional) ───────────────────────────
// During the migration the legacy builder HTML contains a
// <div id="load-modal-container"> in place of the old #load-modal div.
// Mounting here (rather than inside the router) lets the modal live on the
// legacy page without requiring the full React Router tree.
// Both roots share `store` so atoms are consistent across the two trees.
// Collapsed into a single root in the Final PR when all legacy HTML is gone.

const loadModalContainer = document.getElementById("load-modal-container")
if (loadModalContainer) {
  createRoot(loadModalContainer).render(
    <StrictMode>
      <JotaiProvider store={store}>
        <LoadModal />
      </JotaiProvider>
    </StrictMode>,
  )
}
