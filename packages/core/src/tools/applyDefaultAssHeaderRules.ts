import {
  applyAssRules,
  buildFileMetadata,
} from "./applyAssRules.js"
import {
  parseAssFile,
  serializeAssFile,
} from "./assFileTools.js"
import { buildDefaultSubtitleModificationRules } from "./buildDefaultSubtitleModificationRules.js"

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
          })())(
      buildFileMetadata({
        assFile,
        filePath: "embedded.ass",
      }),
    ))(parseAssFile(header))
