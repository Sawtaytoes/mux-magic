import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AppProviders } from "./components/AppProviders"
import { AppRouter } from "./router"
import "./styles/tailwindStyles.css"
import "./styles/builderStyles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
