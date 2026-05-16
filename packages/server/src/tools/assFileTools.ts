import type {
  AssFile,
  AssFormatEntry,
  AssScriptInfoEntry,
  AssSection,
} from "./assTypes.js"

const splitCsvIntoFields = (
  csv: string,
  fieldCount: number,
): string[] => {
  const parts = csv.split(",")
  if (parts.length <= fieldCount) return parts
  return [
    ...parts.slice(0, fieldCount - 1),
    parts.slice(fieldCount - 1).join(","),
  ]
}

const finalizeSection = (
  sectionName: string,
  sectionLines: string[],
): AssSection => {
  if (sectionName === "Script Info") {
    const entries = sectionLines.flatMap(
      (line): AssScriptInfoEntry[] => {
        const trimmed = line.trimEnd()
        if (!trimmed) return []
        if (trimmed.startsWith(";")) {
          return [{ type: "comment", text: trimmed }]
        }
        const colonIdx = trimmed.indexOf(": ")
        if (colonIdx === -1) return []
        return [
          {
            type: "property",
            key: trimmed.slice(0, colonIdx),
            value: trimmed.slice(colonIdx + 2),
          },
        ]
      },
    )
    return {
      sectionName,
      sectionType: "scriptInfo",
      entries,
    }
  }

  const formatLineRaw = sectionLines.find((line) =>
    line.trimStart().startsWith("Format:"),
  )

  if (formatLineRaw) {
    const formatValues = formatLineRaw
      .slice(formatLineRaw.indexOf(":") + 1)
      .trim()
    const format = formatValues
      .split(",")
      .map((field) => field.trim())

    const entries: AssFormatEntry[] = sectionLines.flatMap(
      (line) => {
        const trimmed = line.trimEnd()
        if (
          !trimmed ||
          trimmed.trimStart().startsWith("Format:")
        )
          return []

        const colonIdx = trimmed.indexOf(":")
        if (colonIdx === -1) return []

        const entryType = trimmed
          .slice(0, colonIdx)
          .trimEnd()
        const rest = trimmed.slice(colonIdx + 1).trimStart()
        const values = splitCsvIntoFields(
          rest,
          format.length,
        )

        const fields: Record<string, string> =
          Object.fromEntries(
            format.map((fieldName, idx) => [
              fieldName,
              values[idx] ?? "",
            ]),
          )

        return [{ entryType, fields }]
      },
    )
    return {
      sectionName,
      sectionType: "formatted",
      format,
      entries,
    }
  }

  return {
    sectionName,
    sectionType: "raw",
    lines: sectionLines.filter((line) => line.trim()),
  }
}

type AssParseState = {
  sections: AssSection[]
  currentSectionName: string | null
  currentSectionLines: string[]
}

export const parseAssFile = (content: string): AssFile => {
  const lines = content.replace(/^\uFEFF/, "").split("\n")

  const finalState = lines.reduce<AssParseState>(
    (state, line) => {
      const sectionMatch = line
        .trimEnd()
        .match(/^\[(.+)\]$/)
      if (sectionMatch) {
        return {
          sections:
            state.currentSectionName !== null
              ? state.sections.concat(
                  finalizeSection(
                    state.currentSectionName,
                    state.currentSectionLines,
                  ),
                )
              : state.sections,
          currentSectionName: sectionMatch[1],
          currentSectionLines: [],
        }
      }
      if (state.currentSectionName !== null) {
        return {
          sections: state.sections,
          currentSectionName: state.currentSectionName,
          currentSectionLines:
            state.currentSectionLines.concat(line),
        }
      }
      return state
    },
    {
      sections: [],
      currentSectionName: null,
      currentSectionLines: [],
    },
  )

  const sections =
    finalState.currentSectionName !== null
      ? finalState.sections.concat(
          finalizeSection(
            finalState.currentSectionName,
            finalState.currentSectionLines,
          ),
        )
      : finalState.sections

  return { sections }
}

export const serializeAssFile = (
  assFile: AssFile,
): string => {
  const sectionStrings = assFile.sections.map((section) => {
    const header = `[${section.sectionName}]`

    if (section.sectionType === "scriptInfo") {
      const lines = section.entries.map((entry) =>
        entry.type === "comment"
          ? entry.text
          : `${entry.key}: ${entry.value}`,
      )
      return [header, ...lines].join("\n")
    }

    if (section.sectionType === "formatted") {
      const formatLine = `Format: ${section.format.join(", ")}`
      const entryLines = section.entries.map((entry) => {
        const values = section.format.map(
          (field) => entry.fields[field] ?? "",
        )
        return `${entry.entryType}: ${values.join(",")}`
      })
      return [header, formatLine, ...entryLines].join("\n")
    }

    return [header, ...section.lines].join("\n")
  })

  return `${sectionStrings.join("\n\n")}\n`
}
