import {
  applyAssRules,
  buildFileMetadata,
} from "./applyAssRules.js"
import {
  parseAssFile,
  serializeAssFile,
} from "./assFileTools.js"
import type {
  AssFile,
  AssScriptInfoSection,
  AssSection,
} from "./assTypes.js"
import { buildDefaultSubtitleModificationRules } from "./buildDefaultSubtitleModificationRules.js"

const consolidateScriptInfo = (assFile: AssFile): AssFile =>
  ((scriptInfoSections: AssScriptInfoSection[]) =>
    scriptInfoSections.length <= 1
      ? assFile
      : scriptInfoSections.filter((section) =>
            section.entries.some(
              (entry) => entry.type === "property",
            ),
          ).length === 1
        ? {
            sections: assFile.sections.flatMap(
              (section): AssSection[] =>
                section.sectionType === "scriptInfo"
                  ? section === scriptInfoSections[0]
                    ? [
                        {
                          ...section,
                          entries:
                            scriptInfoSections.flatMap(
                              ({ entries }) => entries,
                            ),
                        },
                      ]
                    : []
                  : [section],
            ),
          }
        : (() => {
            throw new Error(
              "Repeated Script Info requires exactly one property-bearing section; multiple property-bearing Script Info sections are ambiguous",
            )
          })())(
    assFile.sections.filter(
      (section) => section.sectionType === "scriptInfo",
    ),
  )

const buildHeaderMetadata = (assFile: AssFile) => ({
  ...buildFileMetadata({
    assFile,
    filePath: "embedded.ass",
  }),
  styles: assFile.sections.flatMap((section) =>
    section.sectionType === "formatted"
      ? section.entries
          .filter((entry) => entry.entryType === "Style")
          .map(({ fields }) => fields)
      : [],
  ),
})

const retainedProperties = (header: string) =>
  header
    .replace(/\r\n/g, "\n")
    .split("\n")
    .reduce<{
      section: string
      properties: ReadonlyArray<ReadonlyArray<string>>
    }>(
      (state, line) =>
        line.startsWith("[")
          ? { properties: state.properties, section: line }
          : state.section === "[Script Info]" &&
              !line.trimStart().startsWith(";")
            ? ((separator) =>
                separator < 0
                  ? state
                  : (({
                      key,
                      value,
                    }: {
                      key: string
                      value: string
                    }) =>
                      value.length === 0 ||
                      key === "ScriptType" ||
                      key === "YCbCr Matrix"
                        ? state
                        : {
                            section: state.section,
                            properties:
                              state.properties.concat([
                                [key, value],
                              ]),
                          })({
                      key: line.slice(0, separator).trim(),
                      value: line
                        .slice(separator + 1)
                        .trim(),
                    }))(line.indexOf(":"))
            : state,
      { section: "", properties: [] },
    ).properties

const preserveScriptInfo = ({
  original,
  modified,
}: {
  original: string
  modified: string
}) =>
  JSON.stringify(retainedProperties(original)) ===
  JSON.stringify(retainedProperties(modified))
    ? modified
    : (() => {
        throw new Error(
          "Default rules cannot preserve all source Script Info properties",
        )
      })()

export const applyDefaultAssHeaderRules = (
  header: string,
) =>
  ((assFile) =>
    ((metadata) =>
      metadata.styles.length > 0
        ? preserveScriptInfo({
            original: header,
            modified: serializeAssFile(
              applyAssRules({
                assFile,
                fileMetadata: metadata,
                rules:
                  buildDefaultSubtitleModificationRules([
                    metadata,
                  ]),
              }),
            ),
          })
        : (() => {
            throw new Error(
              "ASS CodecPrivate contains no parsed styles",
            )
          })())(buildHeaderMetadata(assFile)))(
    consolidateScriptInfo(parseAssFile(header)),
  )
