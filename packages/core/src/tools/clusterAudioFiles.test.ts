import { describe, expect, test } from "vitest"
import {
  type AudioFileForClustering,
  clusterAudioFiles,
  deriveAlbumName,
  getParentDirectoryName,
  guessAlbumFromFilename,
  VARIOUS_ARTISTS_NAME,
} from "./clusterAudioFiles.js"

const createFile = ({
  album,
  albumArtist,
  artist,
  discNumber,
  filePath,
  trackNumber,
}: {
  album?: string
  albumArtist?: string
  artist?: string
  discNumber?: number
  filePath: string
  trackNumber?: number
}): AudioFileForClustering => ({
  filePath,
  tags: {
    album,
    albumArtist,
    artist,
    discNumber,
    trackNumber,
  },
})

describe(clusterAudioFiles.name, () => {
  test("splits a folder that holds two albums into two clusters", () => {
    const clusters = clusterAudioFiles({
      files: [
        createFile({
          album: "Kind of Blue",
          albumArtist: "Miles Davis",
          filePath: "/inbox/mixed/a.flac",
          trackNumber: 1,
        }),
        createFile({
          album: "Abbey Road",
          albumArtist: "The Beatles",
          filePath: "/inbox/mixed/b.flac",
          trackNumber: 1,
        }),
        createFile({
          album: "Kind of Blue",
          albumArtist: "Miles Davis",
          filePath: "/inbox/mixed/c.flac",
          trackNumber: 2,
        }),
      ],
    })
    expect(clusters).toHaveLength(2)
    expect(
      clusters.map((cluster) => ({
        album: cluster.album,
        albumArtist: cluster.albumArtist,
        trackCount: cluster.trackCount,
      })),
    ).toEqual([
      {
        album: "Kind of Blue",
        albumArtist: "Miles Davis",
        trackCount: 2,
      },
      {
        album: "Abbey Road",
        albumArtist: "The Beatles",
        trackCount: 1,
      },
    ])
  })

  test("keeps one album together when a single file is missing its album-artist tag", () => {
    const clusters = clusterAudioFiles({
      files: [
        createFile({
          album: "Kind of Blue",
          albumArtist: "Miles Davis",
          filePath: "/inbox/kob/01.flac",
          trackNumber: 1,
        }),
        createFile({
          album: "Kind of Blue",
          artist: "Miles Davis",
          filePath: "/inbox/kob/02.flac",
          trackNumber: 2,
        }),
        createFile({
          album: "Kind of Blue",
          albumArtist: "Miles Davis",
          filePath: "/inbox/kob/03.flac",
          trackNumber: 3,
        }),
      ],
    })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].albumArtist).toBe("Miles Davis")
    expect(clusters[0].trackCount).toBe(3)
  })

  test("falls back to the parent directory name when the files carry no album tag", () => {
    const clusters = clusterAudioFiles({
      files: [
        createFile({
          filePath: "/inbox/Some Album Folder/01.flac",
        }),
        createFile({
          filePath: "/inbox/Some Album Folder/02.flac",
        }),
      ],
    })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].album).toBe("Some Album Folder")
    expect(clusters[0].albumArtist).toBe("")
  })

  test("falls back to a filename guess when the directory name says nothing", () => {
    const clusters = clusterAudioFiles({
      files: [
        createFile({
          filePath:
            "/mnt/downloads/01 - Some Album - First.flac",
        }),
        createFile({
          filePath:
            "/mnt/downloads/02 - Some Album - Second.flac",
        }),
      ],
    })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].album).toBe("Some Album")
  })

  test("labels a compilation Various Artists when the tracks do not share one artist", () => {
    const clusters = clusterAudioFiles({
      files: [
        createFile({
          album: "Now That's What I Call Music",
          artist: "Artist A",
          filePath: "/inbox/now/01.flac",
          trackNumber: 1,
        }),
        createFile({
          album: "Now That's What I Call Music",
          artist: "Artist B",
          filePath: "/inbox/now/02.flac",
          trackNumber: 2,
        }),
      ],
    })
    expect(clusters[0].albumArtist).toBe(
      VARIOUS_ARTISTS_NAME,
    )
  })

  test("orders the files inside a cluster by disc then track number", () => {
    const clusters = clusterAudioFiles({
      files: [
        createFile({
          album: "Box Set",
          discNumber: 2,
          filePath: "/inbox/box/d2t1.flac",
          trackNumber: 1,
        }),
        createFile({
          album: "Box Set",
          discNumber: 1,
          filePath: "/inbox/box/d1t2.flac",
          trackNumber: 2,
        }),
        createFile({
          album: "Box Set",
          discNumber: 1,
          filePath: "/inbox/box/d1t1.flac",
          trackNumber: 1,
        }),
      ],
    })
    expect(
      clusters[0].files.map((file) => file.filePath),
    ).toEqual([
      "/inbox/box/d1t1.flac",
      "/inbox/box/d1t2.flac",
      "/inbox/box/d2t1.flac",
    ])
  })

  test("returns an empty list for no files", () => {
    expect(clusterAudioFiles({ files: [] })).toEqual([])
  })
})

describe(deriveAlbumName.name, () => {
  test("prefers the album tag over the directory name", () => {
    expect(
      deriveAlbumName(
        createFile({
          album: "Tagged Album",
          filePath: "/inbox/Directory Name/01.flac",
        }),
      ),
    ).toBe("Tagged Album")
  })
})

describe(getParentDirectoryName.name, () => {
  test("reads the immediate parent folder", () => {
    expect(
      getParentDirectoryName("/inbox/Album Folder/01.flac"),
    ).toBe("Album Folder")
  })
})

describe(guessAlbumFromFilename.name, () => {
  test("drops a leading track number and keeps the first dash-separated segment", () => {
    expect(
      guessAlbumFromFilename(
        "/x/01 - Some Album - First.flac",
      ),
    ).toBe("Some Album")
  })

  test("keeps the whole stem when there is nothing to split on", () => {
    expect(guessAlbumFromFilename("/x/03 Title.mp3")).toBe(
      "Title",
    )
  })
})
