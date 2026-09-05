import {
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"

import {
  COVER_ART_MAXIMUM_BYTES,
  downloadCoverArtImage,
} from "./downloadCoverArtImage.js"

const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
])

beforeEach(() => {
  vi.stubEnv(
    "MUSICBRAINZ_USER_AGENT",
    "mux-magic-test/1.0 ( https://example.com/contact )",
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const stubFetch = (response: Response) =>
  ((fetchMock: ReturnType<typeof vi.fn>) => {
    vi.stubGlobal("fetch", fetchMock)

    return fetchMock
  })(vi.fn(() => Promise.resolve(response)))

test("reads the image type from the bytes, not the declared content type", async () => {
  stubFetch(
    new Response(JPEG_BYTES, {
      // The archive's storage hosts really do answer this for a JPEG.
      headers: { "Content-Type": "application/binary" },
      status: 200,
    }),
  )

  expect(
    await downloadCoverArtImage(
      "https://coverartarchive.org/release/release-1/1.jpg",
    ),
  ).toEqual({ bytes: JPEG_BYTES, mimeType: "image/jpeg" })
})

test("follows redirects, which is how the archive serves every image", async () => {
  const fetchMock = stubFetch(
    new Response(JPEG_BYTES, { status: 200 }),
  )

  await downloadCoverArtImage("https://example.com/1.jpg")

  expect(fetchMock).toHaveBeenCalledWith(
    "https://example.com/1.jpg",
    expect.objectContaining({ redirect: "follow" }),
  )
})

test("identifies itself, because MusicBrainz blocks clients that do not", async () => {
  const fetchMock = stubFetch(
    new Response(JPEG_BYTES, { status: 200 }),
  )

  await downloadCoverArtImage("https://example.com/1.jpg")

  expect(
    (
      fetchMock.mock.calls[0]?.[1] as {
        headers: Record<string, string>
      }
    ).headers["User-Agent"],
  ).toBe(
    "mux-magic-test/1.0 ( https://example.com/contact )",
  )
})

test("names the status when the request fails", async () => {
  stubFetch(new Response("nope", { status: 503 }))

  await expect(
    downloadCoverArtImage("https://example.com/1.jpg"),
  ).rejects.toThrow(/failed with HTTP 503/u)
})

test("refuses a response that is not an image", async () => {
  stubFetch(
    new Response("<!DOCTYPE html>", { status: 200 }),
  )

  await expect(
    downloadCoverArtImage("https://example.com/1.jpg"),
  ).rejects.toThrow(/not a recognised image format/u)
})

test("refuses a response past the size limit", async () => {
  stubFetch(
    new Response(
      new Uint8Array(COVER_ART_MAXIMUM_BYTES + 1),
      { status: 200 },
    ),
  )

  await expect(
    downloadCoverArtImage("https://example.com/1.jpg"),
  ).rejects.toThrow(/past the .* limit/u)
})
