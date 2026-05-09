import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider as JotaiProvider } from "jotai"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

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
