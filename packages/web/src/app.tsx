import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AppRouter } from "./AppRouter"
import { AppProviders } from "./components/AppProviders"
import "./styles/tailwindStyles.css"
import "./styles/builderStyles.css"

const rootElement = document.getElementById("root")
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </StrictMode>,
  )
}
