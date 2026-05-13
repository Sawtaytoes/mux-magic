import { atom } from "jotai"

// eslint-disable-next-line no-restricted-syntax -- frontend SSE connection state; not a server API type
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "unstable"

export const jobsConnectionAtom =
  atom<ConnectionStatus>("connecting")
