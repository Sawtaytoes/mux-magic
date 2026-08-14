import {
  createQueryClient,
  QueryProvider,
} from "@charcuterie/logic/query"
import type { QueryClient } from "@tanstack/react-query"
import {
  type createStore,
  getDefaultStore,
  Provider as JotaiProvider,
} from "jotai"
import type { ReactNode } from "react"

type JotaiStore = ReturnType<typeof createStore>

// The fleet's blessed TanStack Query client + provider
// (@charcuterie/logic/query). mux-magic keeps react-query's own
// defaults — retries stay on — so `createQueryClient()` takes no
// override. A single module-level client preserves the prior
// shared-cache behavior; callers (tests, Storybook) may still pass
// their own via the `queryClient` prop.
const defaultQueryClient = createQueryClient()
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
    <QueryProvider client={queryClient}>
      {children}
    </QueryProvider>
  </JotaiProvider>
)
