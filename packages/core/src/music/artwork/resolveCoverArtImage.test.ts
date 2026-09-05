import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"

import type { CachedFetch } from "../../tools/musicBrainzApi.js"
import { resolveCoverArtImage } from "./resolveCoverArtImage.js"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "resolve-cover-art-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22,
])

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x33, 0x44,
])

const buildArchiveIndex = (imageUrl: string) =>
  JSON.stringify({
    images: [
      {
        approved: true,
        front: true,
        id: 1,
        image: imageUrl,
      },
    ],
  })

const buildCachedFetch = (
  bodyByUrl: Record<string, string>,
): CachedFetch =>
  vi.fn((url: string) =>
    Object.hasOwn(bodyByUrl, url)
      ? Promise.resolve({
          body: bodyByUrl[url] ?? "",
          isFromCache: false,
        })
      : Promise.reject(new Error(`404 for ${url}`)),
  )

const buildFolderWithLocalArt = async (prefix: string) =>
  ((folderPath: string) =>
    writeFile(
      join(folderPath, "cover.png"),
      Buffer.from(PNG_BYTES),
    ).then(() => folderPath))(
    await mkdtemp(join(fixtureDirectoryPath, `${prefix}-`)),
  )

beforeEach(() => {
  vi.stubEnv(
    "MUSICBRAINZ_USER_AGENT",
    "mux-magic-test/1.0 ( https://example.com/contact )",
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JPEG_BYTES, {
          headers: { "Content-Type": "application/binary" },
          status: 200,
        }),
      ),
    ),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

test("an explicit image url wins over every lookup", async () => {
  const folderPath =
    await buildFolderWithLocalArt("explicit")

  expect(
    await resolveCoverArtImage({
      cachedFetch: buildCachedFetch({}),
      folderPath,
      imageUrl: "https://example.com/chosen.jpg",
      releaseId: "release-1",
    }),
  ).toEqual({
    image: { bytes: JPEG_BYTES, mimeType: "image/jpeg" },
    imageUrl: "https://example.com/chosen.jpg",
    source: "image-url",
    sourcePath: null,
  })
})

test("falls back from the release to the release group", async () => {
  const folderPath = await buildFolderWithLocalArt("group")

  expect(
    await resolveCoverArtImage({
      cachedFetch: buildCachedFetch({
        "https://coverartarchive.org/release-group/group-1":
          buildArchiveIndex(
            "https://coverartarchive.org/release-group/group-1/9.jpg",
          ),
      }),
      folderPath,
      releaseGroupId: "group-1",
      releaseId: "release-1",
    }),
  ).toEqual({
    image: { bytes: JPEG_BYTES, mimeType: "image/jpeg" },
    imageUrl:
      "https://coverartarchive.org/release-group/group-1/9.jpg",
    source: "cover-art-archive-release-group",
    sourcePath: null,
  })
})

test("falls back to iTunes when the archive has nothing", async () => {
  const folderPath = await buildFolderWithLocalArt("itunes")

  expect(
    await resolveCoverArtImage({
      albumTitle: "Modular Heart",
      artistName: "M. Harvey Bee",
      cachedFetch: buildCachedFetch({}),
      folderPath,
      itunesCachedFetch: buildCachedFetch({
        "https://itunes.apple.com/search?entity=album&limit=25&media=music&term=M.+Harvey+Bee+Modular+Heart":
          JSON.stringify({
            results: [
              {
                artistName: "M. Harvey Bee",
                artworkUrl100:
                  "https://example.com/a/100x100bb.jpg",
                collectionName: "Modular Heart",
              },
            ],
          }),
      }),
      releaseId: "release-1",
    }),
  ).toEqual({
    image: { bytes: JPEG_BYTES, mimeType: "image/jpeg" },
    imageUrl: "https://example.com/a/1200x1200bb.jpg",
    source: "itunes",
    sourcePath: null,
  })
})

test("iTunes never overrides art the Cover Art Archive already found", async () => {
  const folderPath = await mkdtemp(
    join(fixtureDirectoryPath, "archive-wins-"),
  )
  const itunesCachedFetch = buildCachedFetch({})

  expect(
    (
      await resolveCoverArtImage({
        albumTitle: "Modular Heart",
        artistName: "M. Harvey Bee",
        cachedFetch: buildCachedFetch({
          "https://coverartarchive.org/release/release-1":
            buildArchiveIndex(
              "https://coverartarchive.org/release/release-1/1.jpg",
            ),
        }),
        folderPath,
        itunesCachedFetch,
        releaseId: "release-1",
      })
    )?.source,
  ).toBe("cover-art-archive-release")

  expect(itunesCachedFetch).not.toHaveBeenCalled()
})

test("falls back to art already in the album folder", async () => {
  const folderPath = await buildFolderWithLocalArt("local")

  expect(
    await resolveCoverArtImage({
      cachedFetch: buildCachedFetch({}),
      folderPath,
      releaseId: "release-1",
    }),
  ).toEqual({
    image: { bytes: PNG_BYTES, mimeType: "image/png" },
    imageUrl: null,
    source: "local-file",
    sourcePath: join(folderPath, "cover.png"),
  })
})

test("reports nothing when no provider has art", async () => {
  const folderPath = await mkdtemp(
    join(fixtureDirectoryPath, "none-"),
  )

  expect(
    await resolveCoverArtImage({
      cachedFetch: buildCachedFetch({}),
      folderPath,
      releaseId: "release-1",
    }),
  ).toBeNull()
})

test("does not call the archive when there is no id to look up", async () => {
  const folderPath = await mkdtemp(
    join(fixtureDirectoryPath, "no-ids-"),
  )
  const cachedFetch = buildCachedFetch({})

  expect(
    await resolveCoverArtImage({ cachedFetch, folderPath }),
  ).toBeNull()

  expect(cachedFetch).not.toHaveBeenCalled()
})
