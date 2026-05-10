import {
  type AssFile,
  type AssFormatEntry,
  type AssScriptInfoEntry,
  type AssSection,
} from "./assTypes.js"

const splitCsvIntoFields = (csv: string, fieldCount: number): string[] => {
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
    const entries: AssScriptInfoEntry[] = []
    for (const line of sectionLines) {
      const trimmed = line.trimEnd()
      if (!trimmed) continue
      if (trimmed.startsWith(";")) {
        entries.push({ type: "comment", text: trimmed })
      } else {
        const colonIdx = trimmed.indexOf(": ")
        if (colonIdx !== -1) {
          entries.push({
            type: "property",
            key: trimmed.slice(0, colonIdx),
            value: trimmed.slice(colonIdx + 2),
          })
        }
      }
    }
    return { sectionName, sectionType: "scriptInfo", entries }
  }

  const formatLineRaw = sectionLines.find((line) =>
    line.trimStart().startsWith("Format:")
  )

  if (formatLineRaw) {
    const formatValues = formatLineRaw.slice(
      formatLineRaw.indexOf(":") + 1
    ).trim()
    const format = formatValues.split(",").map((field) => field.trim())

    const entries: AssFormatEntry[] = []
    for (const line of sectionLines) {
      const trimmed = line.trimEnd()
      if (!trimmed || trimmed.trimStart().startsWith("Format:")) continue

      const colonIdx = trimmed.indexOf(":")
      if (colonIdx === -1) continue

      const entryType = trimmed.slice(0, colonIdx).trimEnd()
      const rest = trimmed.slice(colonIdx + 1).trimStart()
      const values = splitCsvIntoFields(rest, format.length)

      const fields: Record<string, string> = {}
      format.forEach((fieldName, idx) => {
        fields[fieldName] = values[idx] ?? ""
      })

      entries.push({ entryType, fields })
    }
    return { sectionName, sectionType: "formatted", format, entries }
  }

  return {
    sectionName,
    sectionType: "raw",
    lines: sectionLines.filter((line) => line.trim()),
  }
}

export const parseAssFile = (content: string): AssFile => {
  const lines = content.replace(/^\uFEFF/, "").split("\n")
  const sections: AssSection[] = []
  let currentSectionName: string | null = null
  let currentSectionLines: string[] = []

  for (const line of lines) {
    const sectionMatch = line.trimEnd().match(/^\[(.+)\]$/)
    if (sectionMatch) {
      if (currentSectionName !== null) {
        sections.push(finalizeSection(currentSectionName, currentSectionLines))
      }
      currentSectionName = sectionMatch[1]
      currentSectionLines = []
    } else if (currentSectionName !== null) {
      currentSectionLines.push(line)
    }
  }

  if (currentSectionName !== null) {
    sections.push(finalizeSection(currentSectionName, currentSectionLines))
  }

  return { sections }
}

export const serializeAssFile = (assFile: AssFile): string => {
  const sectionStrings = assFile.sections.map((section) => {
    const header = `[${section.sectionName}]`

    if (section.sectionType === "scriptInfo") {
      const lines = section.entries.map((entry) =>
        entry.type === "comment"
          ? entry.text
          : `${entry.key}: ${entry.value}`
      )
      return [header, ...lines].join("\n")
    }

    if (section.sectionType === "formatted") {
      const formatLine = `Format: ${section.format.join(", ")}`
      const entryLines = section.entries.map((entry) => {
        const values = section.format.map((field) => entry.fields[field] ?? "")
        return `${entry.entryType}: ${values.join(",")}`
      })
      return [header, formatLine, ...entryLines].join("\n")
    }

    return [header, ...section.lines].join("\n")
  })

  return sectionStrings.join("\n\n") + "\n"
}
