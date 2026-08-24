export type ScriptNode =
  | { kind: "text"; text: string }
  | { kind: "variable"; name: string }
  | {
      kind: "function"
      name: string
      argumentNodes: ScriptNode[][]
    }

type NodeResult = { node: ScriptNode; endIndex: number }
type SequenceResult = {
  nodes: ScriptNode[]
  endIndex: number
}
type ArgumentsResult = {
  argumentNodes: ScriptNode[][]
  endIndex: number
}
type TextScan = { text: string; endIndex: number }

const FUNCTION_HEAD_PATTERN = /^\$([a-zA-Z0-9_]+)\(/
const NUMERIC_PATTERN = /^[+-]?\d+(?:\.\d+)?$/

const ESCAPED_CHARACTERS: Record<string, string> = {
  n: "\n",
  t: "\t",
}

const throwScriptError = (message: string): never => {
  throw new Error(`Picard script: ${message}`)
}

const isSequenceEnd = ({
  character,
  isArgument,
}: {
  character: string | undefined
  isArgument: boolean
}) =>
  character === undefined ||
  (isArgument && (character === "," || character === ")"))

const isTextStop = ({
  character,
  isArgument,
}: {
  character: string | undefined
  isArgument: boolean
}) =>
  character === "%" ||
  character === "$" ||
  isSequenceEnd({ character, isArgument })

const prependText = ({
  text,
  scan,
}: {
  text: string
  scan: TextScan
}) => ({
  text: text + scan.text,
  endIndex: scan.endIndex,
})

const scanEscape = ({
  script,
  index,
  isArgument,
}: {
  script: string
  index: number
  isArgument: boolean
}): TextScan =>
  script[index + 1] === undefined
    ? throwScriptError(
        `trailing backslash at index ${index}.`,
      )
    : prependText({
        text:
          ESCAPED_CHARACTERS[script[index + 1] as string] ??
          (script[index + 1] as string),
        scan: scanText({
          script,
          index: index + 2,
          isArgument,
        }),
      })

const scanText = ({
  script,
  index,
  isArgument,
}: {
  script: string
  index: number
  isArgument: boolean
}): TextScan =>
  script[index] === "\\"
    ? scanEscape({ script, index, isArgument })
    : isTextStop({ character: script[index], isArgument })
      ? { text: "", endIndex: index }
      : prependText({
          text: script[index] as string,
          scan: scanText({
            script,
            index: index + 1,
            isArgument,
          }),
        })

const parseText = ({
  script,
  startIndex,
  isArgument,
}: {
  script: string
  startIndex: number
  isArgument: boolean
}) =>
  ((scan: TextScan) => ({
    node: { kind: "text" as const, text: scan.text },
    endIndex: scan.endIndex,
  }))(scanText({ script, index: startIndex, isArgument }))

const parseVariable = ({
  script,
  startIndex,
}: {
  script: string
  startIndex: number
}) =>
  ((closingIndex: number) =>
    closingIndex > startIndex
      ? {
          node: {
            kind: "variable" as const,
            name: script.slice(
              startIndex + 1,
              closingIndex,
            ),
          },
          endIndex: closingIndex + 1,
        }
      : throwScriptError(
          `unclosed variable reference at index ${startIndex}.`,
        ))(script.indexOf("%", startIndex + 1))

const toFunctionNode = ({
  name,
  argumentsResult,
}: {
  name: string
  argumentsResult: ArgumentsResult
}) => ({
  node: {
    kind: "function" as const,
    name,
    argumentNodes: argumentsResult.argumentNodes,
  },
  endIndex: argumentsResult.endIndex,
})

const prependArgument = ({
  nodes,
  rest,
}: {
  nodes: ScriptNode[]
  rest: ArgumentsResult
}) => ({
  argumentNodes: [nodes].concat(rest.argumentNodes),
  endIndex: rest.endIndex,
})

const finishArguments = ({
  script,
  sequence,
}: {
  script: string
  sequence: SequenceResult
}): ArgumentsResult =>
  script[sequence.endIndex] === ","
    ? prependArgument({
        nodes: sequence.nodes,
        rest: parseArguments({
          script,
          startIndex: sequence.endIndex + 1,
        }),
      })
    : script[sequence.endIndex] === ")"
      ? {
          argumentNodes: [sequence.nodes],
          endIndex: sequence.endIndex + 1,
        }
      : throwScriptError(
          `unclosed function argument list at index ${sequence.endIndex}.`,
        )

const parseArguments = ({
  script,
  startIndex,
}: {
  script: string
  startIndex: number
}): ArgumentsResult =>
  finishArguments({
    script,
    sequence: parseSequence({
      script,
      startIndex,
      isArgument: true,
    }),
  })

const parseFunction = ({
  script,
  startIndex,
}: {
  script: string
  startIndex: number
}): NodeResult =>
  ((headMatch: RegExpExecArray | null) =>
    headMatch
      ? toFunctionNode({
          name: headMatch[1] as string,
          argumentsResult: parseArguments({
            script,
            startIndex: startIndex + headMatch[0].length,
          }),
        })
      : throwScriptError(
          `malformed function call at index ${startIndex}.`,
        ))(
    FUNCTION_HEAD_PATTERN.exec(script.slice(startIndex)),
  )

const parseNode = ({
  script,
  startIndex,
  isArgument,
}: {
  script: string
  startIndex: number
  isArgument: boolean
}): NodeResult =>
  script[startIndex] === "%"
    ? parseVariable({ script, startIndex })
    : script[startIndex] === "$"
      ? parseFunction({ script, startIndex })
      : parseText({ script, startIndex, isArgument })

const continueSequence = ({
  script,
  isArgument,
  nodeResult,
}: {
  script: string
  isArgument: boolean
  nodeResult: NodeResult
}) =>
  ((rest: SequenceResult) => ({
    nodes: [nodeResult.node].concat(rest.nodes),
    endIndex: rest.endIndex,
  }))(
    parseSequence({
      script,
      startIndex: nodeResult.endIndex,
      isArgument,
    }),
  )

const parseSequence = ({
  script,
  startIndex,
  isArgument,
}: {
  script: string
  startIndex: number
  isArgument: boolean
}): SequenceResult =>
  isSequenceEnd({
    character: script[startIndex],
    isArgument,
  })
    ? { nodes: [], endIndex: startIndex }
    : continueSequence({
        script,
        isArgument,
        nodeResult: parseNode({
          script,
          startIndex,
          isArgument,
        }),
      })

export const parsePicardScript = (script: string) =>
  ((sequence: SequenceResult) =>
    sequence.endIndex === script.length
      ? sequence.nodes
      : throwScriptError(
          `unexpected "${script[sequence.endIndex]}" at index ${sequence.endIndex}.`,
        ))(
    parseSequence({
      script,
      startIndex: 0,
      isArgument: false,
    }),
  )

const toNumericOperand = (value: string) =>
  NUMERIC_PATTERN.test(value.trim())
    ? Number(value.trim())
    : null

const compareNumerically = ({
  argumentValues,
  isSatisfied,
}: {
  argumentValues: string[]
  isSatisfied: ({
    left,
    right,
  }: {
    left: number
    right: number
  }) => boolean
}) =>
  ((left: number | null, right: number | null) =>
    left !== null &&
    right !== null &&
    isSatisfied({ left, right })
      ? "1"
      : "")(
    toNumericOperand(argumentValues[0] ?? ""),
    toNumericOperand(argumentValues[1] ?? ""),
  )

const toIntegerArgument = (value: string | undefined) =>
  Math.trunc(toNumericOperand(value ?? "") ?? 0)

const trimCharacter = ({
  text,
  character,
}: {
  text: string
  character: string
}): string =>
  character === ""
    ? text
    : text.startsWith(character)
      ? trimCharacter({
          text: text.slice(character.length),
          character,
        })
      : text.endsWith(character)
        ? trimCharacter({
            text: text.slice(0, -character.length),
            character,
          })
        : text

type ScriptFunction = {
  minimumArgumentCount: number
  apply: (argumentValues: string[]) => string
}

const scriptFunctions: Record<string, ScriptFunction> = {
  and: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      argumentValues.every(
        (argumentValue) => argumentValue !== "",
      )
        ? "1"
        : "",
  },
  eq: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      argumentValues[0] === argumentValues[1] ? "1" : "",
  },
  gt: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      compareNumerically({
        argumentValues,
        isSatisfied: ({ left, right }) => left > right,
      }),
  },
  gte: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      compareNumerically({
        argumentValues,
        isSatisfied: ({ left, right }) => left >= right,
      }),
  },
  if: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      argumentValues[0] !== ""
        ? (argumentValues[1] ?? "")
        : (argumentValues[2] ?? ""),
  },
  if2: {
    minimumArgumentCount: 1,
    apply: (argumentValues) =>
      argumentValues.find(
        (argumentValue) => argumentValue !== "",
      ) ?? "",
  },
  left: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      (argumentValues[0] ?? "").slice(
        0,
        Math.max(0, toIntegerArgument(argumentValues[1])),
      ),
  },
  lower: {
    minimumArgumentCount: 1,
    apply: (argumentValues) =>
      (argumentValues[0] ?? "").toLowerCase(),
  },
  lt: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      compareNumerically({
        argumentValues,
        isSatisfied: ({ left, right }) => left < right,
      }),
  },
  lte: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      compareNumerically({
        argumentValues,
        isSatisfied: ({ left, right }) => left <= right,
      }),
  },
  ne: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      argumentValues[0] === argumentValues[1] ? "" : "1",
  },
  not: {
    minimumArgumentCount: 1,
    apply: (argumentValues) =>
      argumentValues[0] === "" ? "1" : "",
  },
  num: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      String(toIntegerArgument(argumentValues[0])).padStart(
        Math.max(0, toIntegerArgument(argumentValues[1])),
        "0",
      ),
  },
  or: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      argumentValues.some(
        (argumentValue) => argumentValue !== "",
      )
        ? "1"
        : "",
  },
  replace: {
    minimumArgumentCount: 3,
    apply: (argumentValues) =>
      (argumentValues[0] ?? "")
        .split(argumentValues[1] ?? "")
        .join(argumentValues[2] ?? ""),
  },
  right: {
    minimumArgumentCount: 2,
    apply: (argumentValues) =>
      Math.max(0, toIntegerArgument(argumentValues[1])) ===
      0
        ? ""
        : (argumentValues[0] ?? "").slice(
            -Math.max(
              0,
              toIntegerArgument(argumentValues[1]),
            ),
          ),
  },
  trim: {
    minimumArgumentCount: 1,
    apply: (argumentValues) =>
      argumentValues[1] === undefined
        ? (argumentValues[0] ?? "").trim()
        : trimCharacter({
            text: argumentValues[0] ?? "",
            character: argumentValues[1],
          }),
  },
  upper: {
    minimumArgumentCount: 1,
    apply: (argumentValues) =>
      (argumentValues[0] ?? "").toUpperCase(),
  },
}

const applyScriptFunction = ({
  name,
  scriptFunction,
  argumentValues,
}: {
  name: string
  scriptFunction: ScriptFunction
  argumentValues: string[]
}) =>
  argumentValues.length >=
  scriptFunction.minimumArgumentCount
    ? scriptFunction.apply(argumentValues)
    : throwScriptError(
        `$${name} needs at least ${scriptFunction.minimumArgumentCount} arguments, got ${argumentValues.length}.`,
      )

const evaluateFunctionNode = ({
  name,
  argumentNodes,
  variables,
}: {
  name: string
  argumentNodes: ScriptNode[][]
  variables: Record<string, string>
}) =>
  ((scriptFunction: ScriptFunction | undefined) =>
    scriptFunction
      ? applyScriptFunction({
          name,
          scriptFunction,
          argumentValues: argumentNodes.map((nodes) =>
            evaluateNodes({ nodes, variables }),
          ),
        })
      : throwScriptError(`unknown function $${name}.`))(
    scriptFunctions[name],
  )

const evaluateNode = ({
  node,
  variables,
}: {
  node: ScriptNode
  variables: Record<string, string>
}): string =>
  node.kind === "text"
    ? node.text
    : node.kind === "variable"
      ? (variables[node.name] ?? "")
      : evaluateFunctionNode({
          name: node.name,
          argumentNodes: node.argumentNodes,
          variables,
        })

const evaluateNodes = ({
  nodes,
  variables,
}: {
  nodes: ScriptNode[]
  variables: Record<string, string>
}): string =>
  nodes
    .map((node) => evaluateNode({ node, variables }))
    .join("")

export const evaluatePicardScript = ({
  script,
  variables,
}: {
  script: string
  variables: Record<string, string>
}) =>
  evaluateNodes({
    nodes: parsePicardScript(script),
    variables,
  })
