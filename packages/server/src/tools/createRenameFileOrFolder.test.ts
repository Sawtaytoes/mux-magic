import { vol } from "memfs"
import { EmptyError, firstValueFrom } from "rxjs"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { createRenameFileOrFolderObservable, getLastItemInFilePath, renameFileOrFolder } from "./createRenameFileOrFolder.js"
import { captureLogMessage } from "./captureLogMessage.js"

describe(getLastItemInFilePath.name, () => {
  test("gets filename when no path", async () => {
    expect(
      getLastItemInFilePath(
        "Star Wars (1977).mkv"
      )
    )
    .toBe(
      "Star Wars (1977)"
    )
  })

  test("gets filename from shallow path", async () => {
    expect(
      getLastItemInFilePath(
        "~/movies/Star Wars (1977) {edition-4K77}.mkv"
      )
    )
    .toBe(
      "Star Wars (1977) {edition-4K77}"
    )
  })

  test("gets filename from deep path", async () => {
    expect(
      getLastItemInFilePath(
        "~/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv"
      )
    )
    .toBe(
      "Star Wars (1977) {edition-4K77}"
    )
  })

  test("gets folder name from path if no file", async () => {
    expect(
      getLastItemInFilePath(
        "~/movies/Star Wars (1977)"
      )
    )
    .toBe(
      "Star Wars (1977)"
    )
  })
})

describe(renameFileOrFolder.name, () => {
  test("errors when the current file is missing", async () => {
    expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
          oldPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        })
      )
    )
    .rejects
    .toThrow(
      "no such file or directory"
    )
  })

  test("errors when the renamed file already exists", async () => {
    vol
    .fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv": "",
    })

    expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
          oldPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        })
      )
    )
    .rejects
    .toThrow(
      "already exists"
    )
  })

  test("renames a file", async () => {
    vol
    .fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
    })

    expect(
      firstValueFrom(
        renameFileOrFolder({
          newPath: "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
          oldPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
        })
      )
    )
    .resolves
    .toBeUndefined()
  })
})

describe(createRenameFileOrFolderObservable.name, () => {
  test("completes when the old and new names are the same", async () => {
    expect(
      firstValueFrom(
        createRenameFileOrFolderObservable({
          fullPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
          sourcePath: "/movies/Star Wars (1977)",
        })(
          "Star Wars (1977)",
        )
      )
    )
    .rejects
    .toThrow(
      EmptyError
    )
  })

  test("errors when the current file is missing", async () => {
    await (
      captureLogMessage(
        "error",
        async (
          logMessageSpy,
        ) => {
          await (
            expect(
              firstValueFrom(
                createRenameFileOrFolderObservable({
                  fullPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
                  sourcePath: "/movies/Star Wars (1977)",
                })(
                  "Star Wars (1977) {edition-4K77}",
                )
              )
            )
            .rejects
            .toThrow(
              EmptyError
            )
          )

          expect(
            logMessageSpy
            .mock
            .calls
            [0]
            .find((
              error
            ) => (
              error instanceof Error
              && (
                error
                .message
              )
            ))
            .message
          )
          .toContain(
            "no such file or directory"
          )
        }
      )
    )
  })

  test("errors when the renamed file already exists", async () => {
    vol
    .fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
      "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv": "",
    })

    await (
      captureLogMessage(
        "error",
        async (
          logMessageSpy,
        ) => {
          await (
            expect(
              firstValueFrom(
                createRenameFileOrFolderObservable({
                  fullPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
                  sourcePath: "/movies/Star Wars (1977)",
                })(
                  "Star Wars (1977) {edition-4K77}",
                )
              )
            )
            .rejects
            .toThrow(
              EmptyError
            )
          )

          expect(
            logMessageSpy
            .mock
            .calls
            [0]
            .find((
              text
            ) => (
              text
              .includes(
                "already exists"
              )
            ))
          )
          .toContain(
            "already exists"
          )
        }
      )
    )
  })

  test("renames a file", async () => {
    vol
    .fromJSON({
      "/movies/Star Wars (1977)/Star Wars (1977).mkv": "",
    })

    await (
      captureLogMessage(
        "info",
        async (
          logMessageSpy,
        ) => {
          await (
            expect(
              firstValueFrom(
                createRenameFileOrFolderObservable({
                  fullPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
                  sourcePath: "/movies/Star Wars (1977)",
                })(
                  "Star Wars (1977) {edition-4K77}",
                )
              )
            )
            .resolves
            .toEqual({
              newPath: "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv",
              oldPath: "/movies/Star Wars (1977)/Star Wars (1977).mkv",
            })
          )

          const logMessageArgs = (
            logMessageSpy
            .mock
            .calls
            [0]
          )

          expect(
            logMessageArgs
            .find((
              text
            ) => (
              text
              .includes(
                "RENAMED"
              )
            ))
          )
          .toContain(
            "RENAMED"
          )

          expect(
            logMessageArgs
            .find((
              text
            ) => (
              text
              .includes(
                "/movies/Star Wars (1977)/Star Wars (1977).mkv"
              )
            ))
          )
          .toContain(
            "/movies/Star Wars (1977)/Star Wars (1977).mkv"
          )

          expect(
            logMessageArgs
            .find((
              text
            ) => (
              text
              .includes(
                "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv"
              )
            ))
          )
          .toContain(
            "/movies/Star Wars (1977)/Star Wars (1977) {edition-4K77}.mkv"
          )
        }
      )
    )
  })
})
