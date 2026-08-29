import { vol } from "memfs"
import { lastValueFrom, toArray } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { readAudioTags } from "../music/tags/readAudioTags.js"
import { compareMusicAssistantLibrary } from "./compareMusicAssistantLibrary.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

describe(compareMusicAssistantLibrary.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/lookup/01.flac": "first",
      "/lookup/02.flac": "second",
      "/lookup/03.flac": "third",
    })
    process.env.MUSIC_ASSISTANT_API_URL =
      "http://music-assistant.test/api"
    process.env.MUSIC_ASSISTANT_LIBRARY_PROVIDER_ID =
      "filesystem_local--music"
    process.env.MUX_MAGIC_MUSIC_ASSISTANT_TOKEN =
      "test-token"
    vi.mocked(readAudioTags).mockImplementation(
      (filePath: string) =>
        Promise.resolve({
          info: {
            filePath,
            fileSizeBytes: 1,
            hasEmbeddedCoverArt: false,
          },
          tags:
            filePath === "/lookup/01.flac"
              ? { album: "Already Filed" }
              : filePath === "/lookup/02.flac"
                ? { album: "New Album" }
                : {},
        } as Awaited<ReturnType<typeof readAudioTags>>),
    )
  })

  afterEach(() => {
    delete process.env.MUSIC_ASSISTANT_API_URL
    delete process.env.MUSIC_ASSISTANT_LIBRARY_PROVIDER_ID
    delete process.env.MUX_MAGIC_MUSIC_ASSISTANT_TOKEN
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("uses only the configured Music library provider", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve([
          {
            item_id: "1",
            name: "Already Filed",
            provider_mappings: [
              {
                in_library: true,
                provider_instance:
                  "filesystem_local--lookup",
              },
              {
                audio_format: {
                  bit_depth: 24,
                  codec_type: "flac",
                  sample_rate: 96000,
                },
                in_library: true,
                provider_instance:
                  "filesystem_local--music",
              },
            ],
          },
        ]),
      ok: true,
      status: 200,
    })

    const records = await lastValueFrom(
      compareMusicAssistantLibrary({
        fetchImplementation,
        sourcePath: "/lookup",
      }).pipe(toArray()),
    )

    expect(records).toEqual([
      {
        album: "Already Filed",
        artist: null,
        kind: "inMusicLibrary",
        musicAssistantAlbums: [
          {
            audioFormat: {
              bitDepth: 24,
              codec: "flac",
              sampleRate: 96000,
            },
            itemId: "1",
            name: "Already Filed",
            year: null,
          },
        ],
        sourceFilePaths: ["/lookup/01.flac"],
      },
      {
        album: "New Album",
        artist: null,
        kind: "notInMusicLibrary",
        musicAssistantAlbums: [],
        sourceFilePaths: ["/lookup/02.flac"],
      },
      {
        album: "",
        artist: null,
        kind: "untagged",
        musicAssistantAlbums: [],
        sourceFilePaths: ["/lookup/03.flac"],
      },
    ])
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })
})
