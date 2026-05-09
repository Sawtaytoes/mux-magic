import { atom } from "jotai";

export type ConnectionStatus = "connecting" | "connected" | "unstable";

export const jobsConnectionAtom = atom<ConnectionStatus>("connecting");
