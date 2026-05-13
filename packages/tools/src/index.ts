// Public entry for @mux-magic/tools. THIS IS THE ONLY ALLOWED BARREL FILE
// in the entire repository — see AGENTS.md "Module exports — no barrel files".
// It exists because external consumers (the Gallery-Downloader sibling repo,
// plus any future npm consumers) need a single stable import path; without it
// every release would re-publish the package's internal file layout into
// consumer code.
//
// Inside this monorepo, never import from "@mux-magic/tools" — import the
// individual file directly (e.g. "@mux-magic/tools/src/naturalSort").

export {
  aclSafeCopyFile,
  type CopyOptions,
  type CopyProgressEvent,
} from "./aclSafeCopyFile.js"
export { addFolderNameBeforeFilename } from "./addFolderNameBeforeFilename.js"
export { captureConsoleMessage } from "./captureConsoleMessage.js"
export { captureLogMessage } from "./captureLogMessage.js"
export { cleanupFilename } from "./cleanupFilename.js"
export {
  createRenameFileOrFolderObservable,
  getLastItemInFilePath,
  renameFileOrFolder,
} from "./createRenameFileOrFolder.js"
export {
  type FileInfo,
  filterFileAtPath,
  getFiles,
} from "./getFiles.js"
export { getFilesAtDepth } from "./getFilesAtDepth.js"
export {
  type FolderInfo,
  filterFolderAtPath,
  getFolder,
  getIsFolder,
} from "./getFolder.js"
export { insertIntoArray } from "./insertIntoArray.js"
export {
  type DirectoryEntry,
  type ListDirectoryEntriesResult,
  listDirectoryEntries,
} from "./listDirectoryEntries.js"
export { logAndRethrowPipelineError } from "./logAndRethrowPipelineError.js"
export { logAndSwallowPipelineError } from "./logAndSwallowPipelineError.js"
export {
  createAddColorToChalk,
  createLogMessage,
  logError,
  logInfo,
  logWarning,
  messageTemplate,
} from "./logMessage.js"
export { makeDirectory } from "./makeDirectory.js"
export { naturalSort } from "./naturalSort.js"
export { replaceFileExtension } from "./replaceFileExtension.js"
export {
  getOperatorValue,
  runPromiseScheduler,
  runTestScheduler,
} from "./test-runners.js"
