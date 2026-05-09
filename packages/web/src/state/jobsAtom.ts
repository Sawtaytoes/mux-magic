import { atom } from "jotai";
import type { Job } from "../types";

export const jobsAtom = atom<Map<string, Job>>(new Map());
