import {
  Chalk,
  type ColorName,
  type BackgroundColorName,
  type ForegroundColorName,
  ChalkInstance,
} from "chalk"

export const createAddColorToChalk = (
  chalkColor?: ColorName,
) => (
  chalkInstance: ChalkInstance,
) => (
  (
    chalkColor
    && chalkColor in chalkInstance
  )
  ? (
    chalkInstance
    [chalkColor]
  )
  : chalkInstance
)

export const messageTemplate = {
  comparison: (
    firstItem: string,
    secondItem: string,
  ) => (
    [firstItem]
    .concat(
      "\n",
      secondItem,
    )
  ),
  descriptiveComparison: (
    description: any,
    firstItem: string,
    secondItem: string,
  ) => (
    [description]
    .concat(
      "\n",
      "\n",
      firstItem,
      "\n",
      secondItem,
    )
  ),
  noItems: () => (
    []
  ),
  singleItem: (
    item: any,
  ) => (
    [item]
  ),
} as const

const numericalMessageTemplateFallback = {
  0: messageTemplate.noItems,
  1: messageTemplate.singleItem,
  2: messageTemplate.comparison,
  3: messageTemplate.descriptiveComparison,
}

export const createLogMessage = <TemplateName extends keyof typeof messageTemplate>({
  logType,
  templateName,
  titleBackgroundColor,
  titleTextColor,
}: {
  logType: (
    | "error"
    | "info"
    | "log"
    | "warn"
  ),
  templateName?: TemplateName,
  titleBackgroundColor?: BackgroundColorName
  titleTextColor?: ForegroundColorName
}) => (
  title: string,
  ...content: Parameters<(typeof messageTemplate)[TemplateName]>
) => {
  const optionallyColoredChalk = (
    createAddColorToChalk(
      titleBackgroundColor
    )(
      createAddColorToChalk(
        titleTextColor
      )(
        new Chalk()
      )
    )
  )

  const message = (
    templateName
    ? (
      messageTemplate
      [templateName](
        // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.ts(2556)
        ...content
      )
    )
    : (
      content.length in numericalMessageTemplateFallback
      ? (
        numericalMessageTemplateFallback
        [content.length](
          // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.ts(2556)
          ...content
        )
      )
      : null
    )
  )

  console
  [logType](
    (
      optionallyColoredChalk(
        `[${title}]`
      )
    ),
    "\n",
    ...(
      message
      || content
    ),
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

export const logError = (
  createLogMessage({
    logType: "error",
    titleTextColor: "red",
  })
)

export const logInfo = (
  createLogMessage({
    logType: "info",
    titleTextColor: "green",
  })
)

export const logWarning = (
  createLogMessage({
    logType: "warn",
    titleBackgroundColor: "bgYellowBright",
    titleTextColor: "black",
  })
)
