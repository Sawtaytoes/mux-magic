import {
  type BackgroundColorName,
  Chalk,
  type ChalkInstance,
  type ColorName,
  type ForegroundColorName,
} from "chalk"

import {
  getLogger,
  type LogLevel,
} from "./logging/logger.js"
import { getLoggingMode } from "./logging/mode.js"

export const createAddColorToChalk =
  (chalkColor?: ColorName) =>
  (chalkInstance: ChalkInstance) =>
    chalkColor && chalkColor in chalkInstance
      ? chalkInstance[chalkColor]
      : chalkInstance

export const messageTemplate = {
  comparison: (firstItem: string, secondItem: string) =>
    [firstItem].concat("\n", secondItem),
  descriptiveComparison: (
    description: unknown,
    firstItem: string,
    secondItem: string,
  ) =>
    [description].concat(
      "\n",
      "\n",
      firstItem,
      "\n",
      secondItem,
    ),
  // Description followed by N items, each separated by a newline. Useful for
  // download-summary logs and batch-result reports where the caller has a
  // header line plus a variable-length list of details.
  multipleItems: (description: string, items: string[]) =>
    [description].concat(
      "\n",
      items.flatMap((item) => [item].concat("\n")),
    ),
  noItems: () => [],
  singleItem: (item: unknown) => [item],
} as const

const numericalMessageTemplateFallback = {
  0: messageTemplate.noItems,
  1: messageTemplate.singleItem,
  2: messageTemplate.comparison,
  3: messageTemplate.descriptiveComparison,
}

export const createLogMessage =
  <TemplateName extends keyof typeof messageTemplate>({
    logType,
    templateName,
    titleBackgroundColor,
    titleTextColor,
  }: {
    logType: "error" | "info" | "log" | "warn"
    templateName?: TemplateName
    titleBackgroundColor?: BackgroundColorName
    titleTextColor?: ForegroundColorName
  }) =>
  (
    title: string,
    ...content: Parameters<
      (typeof messageTemplate)[TemplateName]
    >
  ) => {
    const optionallyColoredChalk = createAddColorToChalk(
      titleBackgroundColor,
    )(createAddColorToChalk(titleTextColor)(new Chalk()))

    // Fallback dispatch when no templateName is set: a description string +
    // an array of items at positions 0 and 1 is the multipleItems shape.
    // Otherwise pick a template by arity.
    const message = templateName
      ? messageTemplate[templateName](
          // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.ts(2556)
          ...content,
        )
      : content.at(0) !== undefined &&
          Array.isArray(content.at(1))
        ? messageTemplate.multipleItems(
            // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.ts(2556)
            ...content,
          )
        : content.length in numericalMessageTemplateFallback
          ? numericalMessageTemplateFallback[
              content.length
            ](
              // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.ts(2556)
              ...content,
            )
          : null

    const mode = getLoggingMode()
    const messageArray = message || content

    const structuredMsg =
      mode === "api" || mode === "cli-debug"
        ? (messageArray as readonly unknown[])
            .map((part) =>
              typeof part === "string"
                ? part
                : String(part),
            )
            .join(" ")
            .trim()
        : ""

    if (mode === "api" || mode === "cli-debug") {
      const structuredLevel: LogLevel =
        logType === "log" ? "info" : logType
      getLogger()[structuredLevel](structuredMsg, {
        tag: title,
      })
    }

    if (mode === "api") {
      // Errors must never be swallowed: in api mode the structured record
      // is the primary channel (job-log SSE), but a record without a
      // jobId is dropped by the server's bridge sink. Boot errors, the
      // crash handler's CRASH log, and other global error paths must
      // still reach the container's stderr. Skip the chalk path (the
      // structured record is the human-readable one for api consumers).
      if (logType === "error") {
        process.stderr.write(
          `[${title}] ${structuredMsg}\n`,
        )
      }
      return
    }

    console[logType](
      optionallyColoredChalk(`[${title}]`),
      "\n",
      ...(message || content),
      // (
      //   (
      //     content
      //     .length
      //   )
      //   ? (
      //     content
      //     .slice(0, 2)
      //     .join("\n\n")
      //   )
      // ),
      // ...(
      //   (
      //     2 in content
      //   )
      //   ? (
      //     ["\n"]
      //     .concat(
      //       content
      //       .slice(2)
      //       .join("\n")
      //     )
      //   )
      //   : ""
      // ),
      "\n",
      "\n",
    )
  }

export const logError = createLogMessage({
  logType: "error",
  titleTextColor: "red",
})

export const logInfo = createLogMessage({
  logType: "info",
  titleTextColor: "green",
})

export const logWarning = createLogMessage({
  logType: "warn",
  titleBackgroundColor: "bgYellowBright",
  titleTextColor: "black",
})
