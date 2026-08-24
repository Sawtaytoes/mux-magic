import { captureConsoleMessage } from "@mux-magic/tools/test-helpers"
import { firstValueFrom } from "rxjs"
import { describe, expect, test, vi } from "vitest"
import {
  COVER_ART_FILENAME,
  COVER_ART_ORIGINAL_IMAGE_SIZE,
  COVER_ART_PROVIDER_ORDER,
  type CoverArtArchiveRawIndex,
  EXCLUDED_COVER_ART_TYPES,
  getCoverArt,
  getIsCoverArtNotFoundError,
  getLocalCoverArt,
  getTheAudioDbCoverArt,
  isUnapprovedCoverArtAllowedByDefault,
  LOCAL_COVER_ART_PATTERN,
  selectFrontCoverArt,
} from "./coverArtArchive.js"
import type { CachedFetch } from "./musicBrainzApi.js"

const frontIndex: CoverArtArchiveRawIndex = {
  images: [
    {
      id: 111,
      front: false,
      approved: true,
      types: ["Back"],
      image:
        "https://coverartarchive.org/release/release-1/111.jpg",
    },
    {
      id: 222,
      front: true,
      approved: false,
      types: ["Front"],
      image:
        "https://coverartarchive.org/release/release-1/222.jpg",
    },
  ],
}

const createStubCachedFetch = (
  bodyByUrl: Record<string, string>,
) => {
  const stub = vi.fn(async (url: string) => {
    const body = bodyByUrl[url]
    if (body === undefined) {
      throw new Error(
        `Cover Art Archive 404 Not Found: ${url}`,
      )
    }
    return { body, isFromCache: true }
  })
  return stub as unknown as CachedFetch & typeof stub
}

describe("cover art constants", () => {
  test("saves the art beside the files as cover.<ext>", () => {
    expect(COVER_ART_FILENAME).toBe("cover")
  })

  test("asks for the original upload, not a thumbnail", () => {
    expect(COVER_ART_ORIGINAL_IMAGE_SIZE).toBe(-1)
  })

  test("allows unapproved images", () => {
    expect(isUnapprovedCoverArtAllowedByDefault).toBe(true)
  })

  test("never requests matrix/runout, raw/unedited or watermark", () => {
    expect(EXCLUDED_COVER_ART_TYPES).toEqual([
      "matrix/runout",
      "raw/unedited",
      "watermark",
    ])
  })

  test("keeps the provider order release then release-group, with the two later phases after them", () => {
    expect(COVER_ART_PROVIDER_ORDER).toEqual([
      "release",
      "release-group",
      "theaudiodb",
      "local-files",
    ])
  })
})

describe("LOCAL_COVER_ART_PATTERN", () => {
  test("matches the filenames Picard treats as existing local art", () => {
    expect("cover.jpg").toMatch(LOCAL_COVER_ART_PATTERN)
    expect("Folder.jpeg").toMatch(LOCAL_COVER_ART_PATTERN)
    expect("albumart_large.png").toMatch(
      LOCAL_COVER_ART_PATTERN,
    )
    expect("cover.webp").toMatch(LOCAL_COVER_ART_PATTERN)
    expect("cover.tif").toMatch(LOCAL_COVER_ART_PATTERN)
  })

  test("does not match an unrelated image or a non-image", () => {
    expect("back.jpg").not.toMatch(LOCAL_COVER_ART_PATTERN)
    expect("cover.txt").not.toMatch(LOCAL_COVER_ART_PATTERN)
    expect("scan-cover.jpg").not.toMatch(
      LOCAL_COVER_ART_PATTERN,
    )
  })
})

describe(selectFrontCoverArt.name, () => {
  test("picks the front image at its original url, even when it is unapproved", () => {
    expect(
      selectFrontCoverArt({
        provider: "release",
        rawIndex: frontIndex,
      }),
    ).toEqual({
      coverArtId: "222",
      imageUrl:
        "https://coverartarchive.org/release/release-1/222.jpg",
      isApproved: false,
      provider: "release",
      types: ["Front"],
    })
  })

  test("skips the unapproved front image when a call site turns approved-only on", () => {
    expect(
      selectFrontCoverArt({
        isUnapprovedCoverArtAllowed: false,
        provider: "release",
        rawIndex: frontIndex,
      }),
    ).toBeNull()
  })

  test("never returns a matrix/runout, raw/unedited or watermark image", () => {
    expect(
      selectFrontCoverArt({
        provider: "release",
        rawIndex: {
          images: [
            {
              id: 1,
              front: true,
              types: ["Front", "Matrix/Runout"],
              image: "https://example.test/1.jpg",
            },
            {
              id: 2,
              front: true,
              types: ["Front", "Watermark"],
              image: "https://example.test/2.jpg",
            },
          ],
        },
      }),
    ).toBeNull()
  })

  test("returns null when the index holds no front image", () => {
    expect(
      selectFrontCoverArt({
        provider: "release",
        rawIndex: { images: [] },
      }),
    ).toBeNull()
  })
})

describe(getCoverArt.name, () => {
  test("takes the release's front image without asking the release group", async () => {
    const cachedFetch = createStubCachedFetch({
      "https://coverartarchive.org/release/release-1":
        JSON.stringify(frontIndex),
    })
    const image = await firstValueFrom(
      getCoverArt({
        cachedFetch,
        releaseGroupId: "group-1",
        releaseId: "release-1",
      }),
    )
    expect(cachedFetch).toHaveBeenCalledOnce()
    expect(image?.provider).toBe("release")
    expect(image?.coverArtId).toBe("222")
  })

  test("falls back to the release group when the release has no art", async () => {
    const cachedFetch = createStubCachedFetch({
      "https://coverartarchive.org/release-group/group-1":
        JSON.stringify(frontIndex),
    })
    const image = await firstValueFrom(
      getCoverArt({
        cachedFetch,
        releaseGroupId: "group-1",
        releaseId: "release-1",
      }),
    )
    expect(cachedFetch).toHaveBeenCalledTimes(2)
    expect(image?.provider).toBe("release-group")
  })

  test("treats a 404 from both providers as no art, not an error", async () => {
    expect(
      await firstValueFrom(
        getCoverArt({
          cachedFetch: createStubCachedFetch({}),
          releaseGroupId: "group-1",
          releaseId: "release-1",
        }),
      ),
    ).toBeNull()
  })

  test("logs and rethrows a real failure such as a 500", async () =>
    captureConsoleMessage("error", async () => {
      const failingFetch = (async () => {
        throw new Error(
          "Cover Art Archive 500 Internal Server Error",
        )
      }) as unknown as CachedFetch
      await expect(
        firstValueFrom(
          getCoverArt({
            cachedFetch: failingFetch,
            releaseId: "release-1",
          }),
        ),
      ).rejects.toThrow(/500/u)
    }))
})

describe(getIsCoverArtNotFoundError.name, () => {
  test("recognises a 404 and nothing else", () => {
    expect(
      getIsCoverArtNotFoundError(new Error("CAA 404")),
    ).toBe(true)
    expect(
      getIsCoverArtNotFoundError(new Error("Not Found")),
    ).toBe(true)
    expect(
      getIsCoverArtNotFoundError(new Error("CAA 503")),
    ).toBe(false)
    expect(getIsCoverArtNotFoundError("404")).toBe(false)
  })
})

describe("the two later-phase provider seams", () => {
  test("TheAudioDB throws rather than silently reporting no art", () => {
    expect(() => getTheAudioDbCoverArt()).toThrow(
      /not implemented/u,
    )
  })

  test("local cover-art discovery throws rather than silently reporting no art", () => {
    expect(() => getLocalCoverArt()).toThrow(
      /not implemented/u,
    )
  })
})
