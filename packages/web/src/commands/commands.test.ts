import { describe, expect, test } from "vitest"

import { COMMANDS } from "./commands"

describe("addSubtitles offsets field label", () => {
  test("offsets field has the per-episode label", () => {
    const addSubtitlesFields = COMMANDS.addSubtitles.fields
    const offsetsField = addSubtitlesFields.find(
      ({ name }) => name === "offsets",
    )

    expect(offsetsField?.label).toBe(
      "Offsets (milliseconds, one per episode)",
    )
  })
})

describe("COMMANDS field descriptions (regression guard)", () => {
  test("every non-hidden command field has a non-empty description", () => {
    Object.entries(COMMANDS).forEach(
      ([commandName, def]) => {
        def.fields.forEach((field) => {
          if (field.type === "hidden") return
          expect(
            field.description,
            `${commandName}.${field.name} is missing a description`,
          ).toBeTruthy()
        })
      },
    )
  })
})

describe("copyFiles regex / folder fields are surfaced (worker 63)", () => {
  const fields = COMMANDS.copyFiles.fields
  const fieldByName = (name: string) =>
    fields.find((field) => field.name === name)

  test("fileFilterRegex is a string field", () => {
    const field = fieldByName("fileFilterRegex")
    // Worker 65 promoted filter fields to the regex+flags+sample field
    // type. Worker 63 used `string`; the legacy bare-string wire format
    // is still accepted by both schema and component.
    expect(field?.type).toBe("regexWithFlags")
  })

  test("includeFolders is a boolean field", () => {
    const field = fieldByName("includeFolders")
    expect(field?.type).toBe("boolean")
  })

  test("folderFilterRegex is a regexWithFlags field gated by includeFolders", () => {
    const field = fieldByName("folderFilterRegex")
    expect(field?.type).toBe("regexWithFlags")
    expect(field?.visibleWhen).toEqual({
      fieldName: "includeFolders",
      value: true,
    })
  })

  test("renameRegex uses the dedicated nested-object field type", () => {
    const field = fieldByName("renameRegex")
    expect(field?.type).toBe("renameRegex")
  })
})

describe("moveFiles regex fields are surfaced (worker 63)", () => {
  const fields = COMMANDS.moveFiles.fields
  const fieldByName = (name: string) =>
    fields.find((field) => field.name === name)

  test("fileFilterRegex is a regexWithFlags field", () => {
    const field = fieldByName("fileFilterRegex")
    expect(field?.type).toBe("regexWithFlags")
  })

  test("renameRegex uses the dedicated nested-object field type", () => {
    const field = fieldByName("renameRegex")
    expect(field?.type).toBe("renameRegex")
  })

  test("does not surface folder-only fields", () => {
    expect(fieldByName("folderFilterRegex")).toBeUndefined()
    expect(fieldByName("includeFolders")).toBeUndefined()
  })
})
