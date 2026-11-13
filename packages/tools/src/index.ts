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
export {
  aclSafeCopyFolder,
  type CopyFolderOptions,
} from "./aclSafeCopyFolder.js"
export { addFolderNameBeforeFilename } from "./addFolderNameBeforeFilename.js"
export {
  applyRenameRegex,
  type RenameRegex,
  type RenameRegexRule,
} from "./applyRenameRegex.js"
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
  getLoggingContext,
  type LoggerContext,
  loggingContext,
  withLoggingContext,
} from "./logging/context.js"
export { formatLogLine } from "./logging/lineSink.js"
export {
  __resetLogSinksForTests,
  getLogger,
  type Logger,
  type LogLevel,
  type LogRecord,
  type LogSink,
  registerLogSink,
} from "./logging/logger.js"
export {
  __resetLoggingModeForTests,
  getLoggingMode,
  type LoggingMode,
  setLoggingMode,
} from "./logging/mode.js"
export { startSpan } from "./logging/startSpan.js"
export {
  createAddColorToChalk,
  createLogMessage,
  logError,
  logInfo,
  logWarning,
  messageTemplate,
} from "./logMessage.js"
export { makeDirectory } from "./makeDirectory.js"
export {
  getIsMakemkvBackupCompleteMessage,
  getIsMakemkvBackupFailureMessage,
  getIsMakemkvHashCheckFailureMessage,
  getIsMakemkvKeyFailureEvent,
  getIsMakemkvPrompt,
  getIsMakemkvScrambledSectorError,
  getMakemkvSavedTitleCount,
  getMakemkvTitlesSavedFromMessage,
  type MakemkvCurrentProgressTitleEvent,
  type MakemkvDiscAttributeEvent,
  type MakemkvDriveEvent,
  type MakemkvEvent,
  type MakemkvEventType,
  type MakemkvMalformedEvent,
  type MakemkvMessageEvent,
  type MakemkvProgressValuesEvent,
  type MakemkvStreamAttributeEvent,
  type MakemkvTitleAttributeEvent,
  type MakemkvTitleCountEvent,
  type MakemkvTotalProgressTitleEvent,
  type MakemkvUnknownEvent,
  makemkvBoxYesNoMask,
  makemkvBoxYesNoValue,
  makemkvKeyFailureMessageCodes,
  makemkvMessageCode,
  makemkvScrambledSectorMarker,
  makemkvTitlesSavedMessageCodes,
} from "./makemkv/makemkvEvents.js"
export { parseMakemkvLine } from "./makemkv/parseLine.js"
export {
  type ScannedMakemkvLine,
  scanMakemkvFields,
  scanMakemkvLine,
} from "./makemkv/scanFields.js"
export { naturalSort } from "./naturalSort.js"
export {
  postJsonWebhook,
  type WebhookDeliveryResult,
  webhookTimeoutMilliseconds,
} from "./postJsonWebhook.js"
export { renameOntoDestination } from "./renameOntoDestination.js"
export { replaceFileExtension } from "./replaceFileExtension.js"
export {
  SOURCE_PATH_FIELD_NAME,
  SOURCE_PATH_LABEL,
  type SourcePath,
} from "./sourcePath.js"
export {
  defaultSseKeepaliveIntervalMilliseconds,
  type SseKeepaliveStream,
  startSseKeepalive,
} from "./startSseKeepalive.js"
export {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
  mergeMapOrdered,
  registerJobClaim,
  runTask,
  runTasks,
  runTasksOrdered,
  unregisterJobClaim,
} from "./taskScheduler.js"
