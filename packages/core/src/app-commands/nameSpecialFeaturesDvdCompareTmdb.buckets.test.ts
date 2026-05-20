import { join } from "node:path"
import { vol } from "memfs"
import { lastValueFrom, toArray } from "rxjs"
import { describe, expect, test } from "vitest"
import {
  DUPLICATES_BUCKET,
  isBucketFolderName,
  moveFilesToBucket,
  UNNAMED_FEATURES_BUCKET,
} from "./nameSpecialFeaturesDvdCompareTmdb.buckets.js"

describe(isBucketFolderName.name, () => {
  test("matches the two NSF bucket folder names", () => {
    expect(
      isBucketFolderName(UNNAMED_FEATURES_BUCKET),
    ).toBe(true)
    expect(isBucketFolderName(DUPLICATES_BUCKET)).toBe(true)
  })

  test("rejects every other folder name", () => {
    expect(isBucketFolderName("anything-else")).toBe(false)
    expect(isBucketFolderName("Unnamed Features")).toBe(
      false,
    )
    expect(isBucketFolderName("")).toBe(false)
  })
})

describe(moveFilesToBucket.name, () => {
  test("creates the bucket folder lazily and moves every file into it", async () => {
    vol.fromJSON({
      "/disc/MOVIE_t01.mkv": "data1",
      "/disc/MOVIE_t02.mkv": "data2",
    })
    const moves = await lastValueFrom(
      moveFilesToBucket({
        sourcePath: "/disc",
        bucketName: UNNAMED_FEATURES_BUCKET,
        filePaths: [
          "/disc/MOVIE_t01.mkv",
          "/disc/MOVIE_t02.mkv",
        ],
      }).pipe(toArray()),
    )
    expect(moves).toEqual([
      {
        oldPath: "/disc/MOVIE_t01.mkv",
        newPath: join(
          "/disc",
          UNNAMED_FEATURES_BUCKET,
          "MOVIE_t01.mkv",
        ),
      },
      {
        oldPath: "/disc/MOVIE_t02.mkv",
        newPath: join(
          "/disc",
          UNNAMED_FEATURES_BUCKET,
          "MOVIE_t02.mkv",
        ),
      },
    ])
    expect(vol.toJSON()).toEqual({
      "/disc/UNNAMED-FEATURES/MOVIE_t01.mkv": "data1",
      "/disc/UNNAMED-FEATURES/MOVIE_t02.mkv": "data2",
    })
  })

  test("emits nothing AND does not create the bucket folder when filePaths is empty", async () => {
    vol.fromJSON({
      "/disc/Matched-Trailer.mkv": "x",
    })
    const moves = await lastValueFrom(
      moveFilesToBucket({
        sourcePath: "/disc",
        bucketName: UNNAMED_FEATURES_BUCKET,
        filePaths: [],
      }).pipe(toArray()),
    )
    expect(moves).toEqual([])
    expect(vol.toJSON()).toEqual({
      "/disc/Matched-Trailer.mkv": "x",
    })
  })

  test("routes dropped duplicates into DUPLICATES/ as siblings of UNNAMED-FEATURES/", async () => {
    vol.fromJSON({
      "/disc/disc-a.mkv": "a",
      "/disc/disc-b.mkv": "b",
    })
    await lastValueFrom(
      moveFilesToBucket({
        sourcePath: "/disc",
        bucketName: DUPLICATES_BUCKET,
        filePaths: ["/disc/disc-b.mkv"],
      }).pipe(toArray()),
    )
    expect(vol.toJSON()).toEqual({
      "/disc/disc-a.mkv": "a",
      "/disc/DUPLICATES/disc-b.mkv": "b",
    })
  })
})
