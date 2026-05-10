import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import {
  createStore,
  getDefaultStore,
  Provider as JotaiProvider,
} from "jotai"
import type { ReactNode } from "react"

type JotaiStore = ReturnType<typeof createStore>

const defaultQueryClient = new QueryClient()
const defaultStore = getDefaultStore()

type AppProvidersProps = {
  children: ReactNode
  store?: JotaiStore
  queryClient?: QueryClient
}

export const AppProviders = ({
  children,
  store = defaultStore,
  queryClient = defaultQueryClient,
}: AppProvidersProps) => (
  <JotaiProvider store={store}>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </JotaiProvider>
)
