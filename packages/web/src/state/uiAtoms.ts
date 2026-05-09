import { atom } from "jotai";

export const loadModalOpenAtom = atom<boolean>(false);
export const selectedStepIdAtom = atom<string | null>(null);
export const dryRunAtom = atom<boolean>(false);
export const failureModeAtom = atom<boolean>(false);
