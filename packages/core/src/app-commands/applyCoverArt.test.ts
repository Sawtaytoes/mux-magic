import {
  mkdtemp,
  readdir as readDirectory,
  readdir,
  rm,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { File } from "node-taglib-sharp"
import { concatMap, firstValueFrom, from } from "rxjs"
import {
  afterAll,
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"

vi.unmock("node:fs")
vi.unmock("node:fs/promises")
vi.unmock("../cli-spawn-operations/runFfmpeg.js")
vi.unmock("../cli-spawn-operations/treeKillChild.js")

// `getFilesAtDepth` lives in the built `@mux-magic/tools`, whose own
// `node:fs` import is not reached by the unmocks above, so it would list a
// memfs volume that has none of these fixtures. The listing is replaced with
// a real directory read; everything the command does after it — taglib,
// ffmpeg, the folder write — runs against the real files.
vi.mock("@mux-magic/tools", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@mux-magic/tools")
  >()),
  getFilesAtDepth: vi.fn(
    ({ sourcePath }: { sourcePath: string }) =>
      from(
        readDirectory(sourcePath, {
          withFileTypes: true,
        }).then((entries) =>
          entries
            .filter((entry) => entry.isFile())
            .map((entry) => ({
              fullPath: join(sourcePath, entry.name),
              name: entry.name,
            })),
        ),
      ).pipe(concatMap((fileInfos) => from(fileInfos))),
  ),
}))

const { generateAudioFixture, getIsFfmpegAvailable } =
  await import("../music/fixtures/generateAudioFixture.js")
const { applyCoverArt } = await import("./applyCoverArt.js")

type CachedFetch =
  import("../tools/musicBrainzApi.js").CachedFetch

const isFfmpegAvailable = await getIsFfmpegAvailable()
const isFfmpegMissing = !isFfmpegAvailable

if (isFfmpegMissing) {
  console.warn(
    "applyCoverArt.test.ts: ffmpeg is not on PATH, so every fixture-backed test is skipped.",
  )
}

const fixtureDirectoryPath = await mkdtemp(
  join(tmpdir(), "apply-cover-art-"),
)

afterAll(async () => {
  await rm(fixtureDirectoryPath, {
    force: true,
    recursive: true,
  })
})

const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x41, 0x42, 0x43,
])

const emptyCachedFetch: CachedFetch = vi.fn(() =>
  Promise.reject(new Error("404 not found")),
)

const buildAlbumFolder = async ({
  prefix,
  trackCount,
}: {
  prefix: string
  trackCount: number
}) =>
  ((folderPath: string) =>
    Promise.all(
      Array.from({ length: trackCount }, (_unused, index) =>
        generateAudioFixture({
          format: "flac",
          outputPath: join(
            folderPath,
            `0${index + 1} Track.flac`,
          ),
        }),
      ),
    ).then(() => folderPath))(
    await mkdtemp(join(fixtureDirectoryPath, `${prefix}-`)),
  )

const readPictureCount = (filePath: string) => {
  const audioFile = File.createFromPath(filePath)

  try {
    return audioFile.tag.pictures.length
  } finally {
    audioFile.dispose()
  }
}

beforeEach(() => {
  vi.stubEnv(
    "MUSICBRAINZ_USER_AGENT",
    "mux-magic-test/1.0 ( https://example.com/contact )",
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JPEG_BYTES, { status: 200 }),
      ),
    ),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

test.skipIf(isFfmpegMissing)(
  "writes cover.jpg once and embeds it in every file",
  async () => {
    const folderPath = await buildAlbumFolder({
      prefix: "album",
      trackCount: 3,
    })

    const result = await firstValueFrom(
      applyCoverArt({
        cachedFetch: emptyCachedFetch,
        imageUrl: "https://example.com/cover.jpg",
        sourcePath: folderPath,
      }),
    )

    expect(result.source).toBe("image-url")
    expect(result.isCoverArtFileWritten).toBe(true)
    expect(result.coverArtFilePath).toBe(
      join(folderPath, "cover.jpg"),
    )
    expect(result.mimeType).toBe("image/jpeg")
    expect(
      result.records.filter(
        (record) => record.kind === "written",
      ),
    ).toHaveLength(3)

    expect(
      (await readdir(folderPath)).includes("cover.jpg"),
    ).toBe(true)

    expect(
      readPictureCount(join(folderPath, "01 Track.flac")),
    ).toBe(1)
  },
)

test.skipIf(isFfmpegMissing)(
  "a second run over the same folder changes nothing",
  async () => {
    const folderPath = await buildAlbumFolder({
      prefix: "idempotent",
      trackCount: 2,
    })

    await firstValueFrom(
      applyCoverArt({
        cachedFetch: emptyCachedFetch,
        imageUrl: "https://example.com/cover.jpg",
        sourcePath: folderPath,
      }),
    )

    const secondResult = await firstValueFrom(
      applyCoverArt({
        cachedFetch: emptyCachedFetch,
        imageUrl: "https://example.com/cover.jpg",
        sourcePath: folderPath,
      }),
    )

    expect(
      secondResult.records.every(
        (record) => record.kind === "unchanged",
      ),
    ).toBe(true)

    expect(secondResult.isCoverArtFileWritten).toBe(false)
  },
)

test.skipIf(isFfmpegMissing)(
  "a dry run reports the writes and touches nothing",
  async () => {
    const folderPath = await buildAlbumFolder({
      prefix: "dry-run",
      trackCount: 2,
    })

    const result = await firstValueFrom(
      applyCoverArt({
        cachedFetch: emptyCachedFetch,
        imageUrl: "https://example.com/cover.jpg",
        isDryRun: true,
        sourcePath: folderPath,
      }),
    )

    expect(
      result.records.filter(
        (record) => record.kind === "written",
      ),
    ).toHaveLength(2)

    expect(
      (await readdir(folderPath)).includes("cover.jpg"),
    ).toBe(false)

    expect(
      readPictureCount(join(folderPath, "01 Track.flac")),
    ).toBe(0)
  },
)

test.skipIf(isFfmpegMissing)(
  "reports no source when no provider has art for the folder",
  async () => {
    const folderPath = await buildAlbumFolder({
      prefix: "no-art",
      trackCount: 1,
    })

    const result = await firstValueFrom(
      applyCoverArt({
        cachedFetch: emptyCachedFetch,
        sourcePath: folderPath,
      }),
    )

    expect(result).toEqual({
      coverArtFilePath: null,
      imageByteCount: null,
      imageUrl: null,
      isCoverArtFileWritten: false,
      mimeType: null,
      records: [],
      source: null,
    })
  },
)

test.skipIf(isFfmpegMissing)(
  "reports no source for a folder that holds no audio",
  async () => {
    const folderPath = await mkdtemp(
      join(fixtureDirectoryPath, "empty-"),
    )

    expect(
      (
        await firstValueFrom(
          applyCoverArt({
            cachedFetch: emptyCachedFetch,
            imageUrl: "https://example.com/cover.jpg",
            sourcePath: folderPath,
          }),
        )
      ).source,
    ).toBeNull()
  },
)

test.skipIf(isFfmpegMissing)(
  "can embed without writing a file beside the tracks",
  async () => {
    const folderPath = await buildAlbumFolder({
      prefix: "embed-only",
      trackCount: 1,
    })

    const result = await firstValueFrom(
      applyCoverArt({
        cachedFetch: emptyCachedFetch,
        imageUrl: "https://example.com/cover.jpg",
        isSavedBesideFiles: false,
        sourcePath: folderPath,
      }),
    )

    expect(result.isCoverArtFileWritten).toBe(false)
    expect(
      (await readdir(folderPath)).includes("cover.jpg"),
    ).toBe(false)
    expect(
      readPictureCount(join(folderPath, "01 Track.flac")),
    ).toBe(1)
  },
)

// The Discogs step is reached from the tags alone: the release id in the
// files sends one request to MusicBrainz for the barcode, and the barcode
// sends one to Discogs. Nothing about it is passed in by the caller.
const buildRoutedCachedFetch = (
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

test.skipIf(isFfmpegMissing)(
  "reaches Discogs with the barcode MusicBrainz holds for the tagged release",
  async () => {
    const folderPath = await mkdtemp(
      join(fixtureDirectoryPath, "discogs-"),
    )

    await generateAudioFixture({
      format: "flac",
      outputPath: join(folderPath, "01 Track.flac"),
      tags: {
        ALBUM: "Modular Heart",
        ALBUMARTIST: "M. Harvey Bee",
        MUSICBRAINZ_ALBUMID: "release-9",
      },
    })

    const result = await firstValueFrom(
      applyCoverArt({
        cachedFetch: buildRoutedCachedFetch({
          "https://musicbrainz.org/ws/2/release/release-9?inc=recordings+artist-credits+labels+release-groups+media+artist-rels+recording-rels+genres+tags&fmt=json":
            JSON.stringify({
              barcode: "724381059029",
              id: "release-9",
              title: "Modular Heart",
            }),
        }),
        discogsCachedFetch: buildRoutedCachedFetch({
          "https://api.discogs.com/database/search?barcode=724381059029&per_page=50&type=release":
            JSON.stringify({ results: [{ id: 272692 }] }),
          "https://api.discogs.com/releases/272692":
            JSON.stringify({
              id: 272692,
              images: [
                {
                  height: 500,
                  type: "primary",
                  uri: "https://i.discogs.com/front-500.jpeg",
                  width: 500,
                },
              ],
              title: "Modular Heart",
            }),
        }),
        itunesCachedFetch: emptyCachedFetch,
        sourcePath: folderPath,
      }),
    )

    expect(result.source).toBe("discogs")
    expect(result.imageUrl).toBe(
      "https://i.discogs.com/front-500.jpeg",
    )
    expect(
      readPictureCount(join(folderPath, "01 Track.flac")),
    ).toBe(1)
  },
)
