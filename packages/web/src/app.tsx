import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { getDefaultStore, Provider as JotaiProvider } from "jotai"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { ApiRunModal } from "./components/ApiRunModal"
import { CommandPicker } from "./components/CommandPicker"
import { EnumPicker } from "./components/EnumPicker"
import { FileExplorerModal } from "./components/FileExplorerModal"
import { LinkPicker } from "./components/LinkPicker"
import { LoadModal } from "./components/LoadModal"
import { LookupModal } from "./components/LookupModal"
import { PageHeader } from "./components/PageHeader"
import { PathPicker } from "./components/PathPicker"
import { PromptModal } from "./components/PromptModal"
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

// ─── Pickers (legacy HTML context — transitional) ─────────────────────────────
// All four pickers render via createPortal into document.body, so they only
// need a single tiny mount point. Triggers are legacy DOM buttons/inputs that
// call window.commandPicker.open() / window.enumPicker.open() etc., which write
// into Jotai atoms via the bridge. Collapsed into the main root in the Final PR.

const pickersContainer = document.getElementById("pickers-container")
if (pickersContainer) {
  createRoot(pickersContainer).render(
    <StrictMode>
      <JotaiProvider store={store}>
        <CommandPicker />
        <EnumPicker />
        <LinkPicker />
        <PathPicker />
      </JotaiProvider>
    </StrictMode>,
  )
}

// ─── Wave E: PageHeader ───────────────────────────────────────────────────────
// The React PageHeader replaces the #page-header div content.

const pageHeaderContainer = document.getElementById("page-header-container")
if (pageHeaderContainer) {
  createRoot(pageHeaderContainer).render(
    <StrictMode>
      <JotaiProvider store={store}>
        <PageHeader />
      </JotaiProvider>
    </StrictMode>,
  )
}

// ─── Wave E: Overlay modals ───────────────────────────────────────────────────
// All five modals share one React root. They're portal-mounted overlays so
// nesting them in a single container has no visual effect.

const waveEContainer = document.getElementById("wave-e-container")
if (waveEContainer) {
  createRoot(waveEContainer).render(
    <StrictMode>
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <PromptModal />
          <ApiRunModal />
          <LookupModal />
          <FileExplorerModal />
        </QueryClientProvider>
      </JotaiProvider>
    </StrictMode>,
  )
}
