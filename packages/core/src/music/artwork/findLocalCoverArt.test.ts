import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, expect, test, vi } from "vitest"

import {
  findLocalCoverArt,
  selectLocalCoverArtFilename,
} from "./findLocalCoverArt.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "find-local-cover-art-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

test("prefers cover over folder over albumart", () => {
  expect(
    selectLocalCoverArtFilename([
      "albumart_large.jpg",
      "folder.jpg",
      "cover.png",
    ]),
  ).toBe("cover.png")

  expect(
    selectLocalCoverArtFilename([
      "albumart_large.jpg",
      "Folder.jpg",
    ]),
  ).toBe("Folder.jpg")
})

test("prefers the shortest name within one prefix", () => {
  expect(
    selectLocalCoverArtFilename([
      "cover (1).jpg",
      "cover.jpg",
    ]),
  ).toBe("cover.jpg")
})

test("ignores files that are not cover art", () => {
  expect(
    selectLocalCoverArtFilename([
      "01 Track.flac",
      "booklet.pdf",
      "back.jpg",
    ]),
  ).toBeNull()
})

test("finds nothing in a folder that has no art", async () => {
  const emptyFolderPath = await mkdtemp(
    join(fixtureDirectoryPath, "empty-"),
  )

  expect(
    await findLocalCoverArt(emptyFolderPath),
  ).toBeNull()
})

test("finds nothing when the folder does not exist", async () => {
  expect(
    await findLocalCoverArt(
      join(fixtureDirectoryPath, "not-a-folder"),
    ),
  ).toBeNull()
})

test("returns the full path of the art it found", async () => {
  const folderPath = await mkdtemp(
    join(fixtureDirectoryPath, "with-art-"),
  )

  await writeFile(join(folderPath, "cover.jpg"), "not-real")

  expect(await findLocalCoverArt(folderPath)).toBe(
    join(folderPath, "cover.jpg"),
  )
})
