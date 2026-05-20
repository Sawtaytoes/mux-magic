import { commandNames } from "@mux-magic/api/command-names"
import { describe, expect, test } from "vitest"

import { commandLabels } from "../jobs/commandLabels"
import { COMMANDS } from "./commands"

// Registry-sync invariant: every command the server registers in
// `commandNames` must be wired into the web builder. There is no
// compile-time link between the three registries, so this test is the
// only guard against a future worker shipping a command that's
// API/CLI-callable but invisible (or unlabeled) in the sidebar.
//
// Historical misses that motivated this test:
//   - Worker 40 (moveFilesIntoNamedFolders / distributeFolderToSiblings
//     / flattenChildFolders) initially shipped without entries in
//     COMMANDS — fixed in PR #148.
//   - renumberChapters had been in commandNames since worker 4d but
//     was missing from COMMANDS until the audit that produced this test.
//   - renameFiles was in COMMANDS but missing from commandLabels.
//
// If you intentionally want a server command hidden from the picker
// (e.g. an admin-only or deprecated alias), keep it out of
// `commandNames` rather than weakening this test.
describe("Command registry sync (commandNames ↔ COMMANDS ↔ commandLabels)", () => {
  test("every server-side commandName has an entry in the web COMMANDS map", () => {
    const missing = commandNames.filter(
      (name) => !(name in COMMANDS),
    )
    expect(
      missing,
      `commandNames present in server but missing from web COMMANDS: ${missing.join(", ")}`,
    ).toEqual([])
  })

  test("every server-side commandName has a human label in commandLabels", () => {
    const missing = commandNames.filter(
      (name) => !(name in commandLabels),
    )
    expect(
      missing,
      `commandNames present in server but missing a custom label in commandLabels: ${missing.join(", ")}`,
    ).toEqual([])
  })

  test("every key in web COMMANDS is registered as a server commandName", () => {
    const serverNames = new Set<string>(commandNames)
    const orphans = Object.keys(COMMANDS).filter(
      (name) => !serverNames.has(name),
    )
    expect(
      orphans,
      `web COMMANDS keys with no matching server commandName (clicking these in the builder will 404): ${orphans.join(", ")}`,
    ).toEqual([])
  })
})

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
