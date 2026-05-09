import { atom } from "jotai";
import type { SequenceItem } from "../types";

export const stepsAtom = atom<SequenceItem[]>([]);
export const stepCounterAtom = atom<number>(0);
