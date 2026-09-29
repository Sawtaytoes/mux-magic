import { getLoggingContext } from "@mux-magic/tools"

// Network-first means every read asks the provider. Against a provider
// that is DOWN, every read then waits for its timeout before it can fall
// back — a batch over 200 files would spend 200 timeouts learning one
// fact. So the first failure that says "this provider is unreachable"
// opens a circuit for that provider, scoped to the job, and every later
// read in the same job goes straight to the cache (still reported).
//
// The circuit is scoped to the ROOT job, so the steps of one sequence share
// it — a sequence whose first step found DVDCompare down does not make its
// third step wait out the timeout again. In the CLI, where one process is
// one command run, the scope is the process. In the server, a request made
// outside any job (a Builder lookup) has NO circuit: a person pressing
// search again wants the provider asked again, not a remembered failure.
//
// It closes itself after a cooldown: the next read is a probe, and a
// success clears it. A long job therefore picks the provider back up after
// a short outage instead of running the rest of the night on the cache.
export const PROVIDER_CIRCUIT_COOLDOWN_MILLISECONDS =
  2 * 60 * 1000

const PROCESS_SCOPE = "process"

type OpenCircuit = {
  cause: string
  openedAt: number
}

const openCircuits = new Map<string, OpenCircuit>()

// `null` means "no circuit for this read".
type ScopeResolver = (
  jobId: string | undefined,
) => string | null

// The server installs a resolver that maps a step's job id to its
// sequence's id and gives job-less reads no circuit. Without one (the CLI),
// a job is its own scope and everything else shares the process scope.
const scopeResolverHolder = new Map<
  "instance",
  ScopeResolver
>()

const resolveScopeByDefault: ScopeResolver = (jobId) =>
  jobId ?? PROCESS_SCOPE

export const setProviderCircuitScopeResolver = (
  resolver: ScopeResolver | null,
) => {
  if (resolver === null) {
    scopeResolverHolder.clear()
  } else {
    scopeResolverHolder.set("instance", resolver)
  }
}

const resolveCircuitKey = (provider: string) =>
  ((scope: string | null) =>
    scope === null ? null : `${scope}\u0000${provider}`)(
    (
      scopeResolverHolder.get("instance") ??
      resolveScopeByDefault
    )(getLoggingContext().jobId),
  )

const isCircuitCoolingDown = (openCircuit: OpenCircuit) =>
  Date.now() - openCircuit.openedAt <
  PROVIDER_CIRCUIT_COOLDOWN_MILLISECONDS

// Entries past their cooldown mean nothing any more. Dropping them here
// keeps a long-lived server from holding one entry per job forever.
const pruneExpiredCircuits = () => {
  Array.from(openCircuits.entries())
    .filter(
      ([, openCircuit]) =>
        isCircuitCoolingDown(openCircuit) === false,
    )
    .forEach(([circuitKey]) => {
      openCircuits.delete(circuitKey)
    })
}

export const getOpenProviderCircuit = (provider: string) =>
  ((openCircuit: OpenCircuit | undefined) =>
    openCircuit !== undefined &&
    isCircuitCoolingDown(openCircuit)
      ? openCircuit
      : null)(
    ((circuitKey: string | null) =>
      circuitKey === null
        ? undefined
        : openCircuits.get(circuitKey))(
      resolveCircuitKey(provider),
    ),
  )

export const openProviderCircuit = ({
  cause,
  provider,
}: {
  cause: string
  provider: string
}) => {
  const circuitKey = resolveCircuitKey(provider)
  if (circuitKey !== null) {
    pruneExpiredCircuits()
    openCircuits.set(circuitKey, {
      cause,
      openedAt: Date.now(),
    })
  }
}

export const closeProviderCircuit = (provider: string) => {
  const circuitKey = resolveCircuitKey(provider)
  if (circuitKey !== null) {
    openCircuits.delete(circuitKey)
  }
}

export const resetProviderCircuitsForTests = () => {
  openCircuits.clear()
  scopeResolverHolder.clear()
}

// What the network-first read rejects with when the circuit is open and
// there is nothing cached to serve. Named so a caller that has its own
// last resort (DVDCompare's Wayback archive) can recognise it.
export class ProviderSkippedError extends Error {
  readonly provider: string

  constructor({
    cause,
    provider,
    request,
  }: {
    cause: string
    provider: string
    request: string
  }) {
    super(
      `${provider} already failed earlier in this run, so ${request} was not requested, and nothing is cached for it. Earlier failure: ${cause}`,
    )
    this.name = "ProviderSkippedError"
    this.provider = provider
  }
}
