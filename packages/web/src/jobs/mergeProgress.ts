import type { ProgressSnapshot } from "../types";

export const mergeProgress = (
  snapshot: ProgressSnapshot | undefined,
  event: Partial<ProgressSnapshot>,
): ProgressSnapshot => {
  const merged: ProgressSnapshot = { ...snapshot };
  if (event.ratio !== undefined) merged.ratio = event.ratio;
  if (event.filesDone !== undefined) merged.filesDone = event.filesDone;
  if (event.filesTotal !== undefined) merged.filesTotal = event.filesTotal;
  if (event.bytesPerSecond !== undefined)
    merged.bytesPerSecond = event.bytesPerSecond;
  if (event.bytesRemaining !== undefined)
    merged.bytesRemaining = event.bytesRemaining;
  // currentFiles is authoritative: absence means "no active files", clear previous.
  merged.currentFiles = Array.isArray(event.currentFiles)
    ? event.currentFiles
    : [];
  return merged;
};
