import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider } from "jotai"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AppRouter } from "./router"
import "./styles/tailwindStyles.css"
import "./styles/builderStyles.css"

const queryClient = new QueryClient()

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("#root element missing from index.html")
}

createRoot(rootElement).render(
  <StrictMode>
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </JotaiProvider>
  </StrictMode>,
)
