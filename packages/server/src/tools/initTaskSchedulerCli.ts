import { initTaskScheduler } from "./taskScheduler.js"

// Imported as a side-effect from src/cli.ts as the FIRST import so the
// scheduler is initialized at concurrency=1 before any app-command
// module body runs. A constant-1 scheduler is functionally equivalent
// to the historical concatMap behavior — Tasks queue and execute one
// at a time, preserving CLI ergonomics (in-order logs, sequential
// file ops).
initTaskScheduler(1)
