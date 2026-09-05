import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, expect, test, vi } from "vitest"

import type { CoverArtImage } from "./coverArtImage.js"
import { saveCoverArtFile } from "./saveCoverArtFile.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "save-cover-art-file-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

const buildImage = (
  mimeType = "image/jpeg",
): CoverArtImage => ({
  bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0x01, 0x02]),
  mimeType,
})

const createFolder = (prefix: string) =>
  mkdtemp(join(fixtureDirectoryPath, `${prefix}-`))

test("writes cover.jpg into a folder that has no art", async () => {
  const folderPath = await createFolder("empty")

  expect(
    await saveCoverArtFile({
      folderPath,
      image: buildImage(),
    }),
  ).toEqual({
    coverArtFilePath: join(folderPath, "cover.jpg"),
    isWritten: true,
    reason: "written",
  })

  expect(
    Uint8Array.from(
      await readFile(join(folderPath, "cover.jpg")),
    ),
  ).toEqual(buildImage().bytes)
})

test("uses the extension the image's own bytes call for", async () => {
  const folderPath = await createFolder("png")

  expect(
    (
      await saveCoverArtFile({
        folderPath,
        image: buildImage("image/png"),
      })
    ).coverArtFilePath,
  ).toBe(join(folderPath, "cover.png"))
})

test("never overwrites art the folder already has", async () => {
  const folderPath = await createFolder("existing")

  await writeFile(join(folderPath, "cover.jpg"), "chosen")

  expect(
    await saveCoverArtFile({
      folderPath,
      image: buildImage(),
    }),
  ).toEqual({
    coverArtFilePath: join(folderPath, "cover.jpg"),
    isWritten: false,
    reason: "already-present",
  })

  expect(
    await readFile(join(folderPath, "cover.jpg"), "utf8"),
  ).toBe("chosen")
})

test("a Folder.jpg left by another program also counts as already present", async () => {
  const folderPath = await createFolder("folder-jpg")

  await writeFile(join(folderPath, "Folder.jpg"), "chosen")

  expect(
    (
      await saveCoverArtFile({
        folderPath,
        image: buildImage(),
      })
    ).reason,
  ).toBe("already-present")

  expect(await readdir(folderPath)).toEqual(["Folder.jpg"])
})

test("a dry run names the file it would write and writes nothing", async () => {
  const folderPath = await createFolder("dry-run")

  expect(
    await saveCoverArtFile({
      folderPath,
      image: buildImage(),
      isDryRun: true,
    }),
  ).toEqual({
    coverArtFilePath: join(folderPath, "cover.jpg"),
    isWritten: false,
    reason: "dry-run",
  })

  expect(await readdir(folderPath)).toEqual([])
})

test("refuses an image type that has no filename extension", async () => {
  const folderPath = await createFolder("unsupported")

  await expect(
    saveCoverArtFile({
      folderPath,
      image: buildImage("image/heic"),
    }),
  ).rejects.toThrow(/unsupported image type/u)
})
