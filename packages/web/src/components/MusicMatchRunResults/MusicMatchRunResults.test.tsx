import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { tagMatchModalAtom } from "../TagMatchModal/tagMatchModalAtom"
import type { TagMatchFile } from "../TagMatchModal/tagMatchTypes"
import {
  countMusicMatchFiles,
  dropAppliedMusicMatchFiles,
  findMusicMatchClusters,
  flattenMusicMatchFiles,
  isMusicMatchCluster,
} from "./findMusicMatchResults"
import { MusicMatchRunResults } from "./MusicMatchRunResults"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const buildFile = ({
  confidence = 0.9,
  filename,
}: {
  confidence?: number
  filename: string
}): TagMatchFile => ({
  currentTags: { title: filename },
  durationSeconds: 210,
  extension: ".flac",
  filePath: `/inbox/${filename}`,
  filename,
  rankedCandidates:
    confidence === 0
      ? []
      : [
          {
            candidate: {
              artistName: "Harbour Lights",
              releaseId: "release-1",
              releaseTitle: "Long Way Down",
              source: "musicbrainz",
            },
            confidence,
            proposedTags: { title: filename },
          },
        ],
})

const renderPanel = ({
  files,
  sourcePath = "/inbox",
  store = createStore(),
}: {
  files: TagMatchFile[]
  sourcePath?: string | null
  store?: ReturnType<typeof createStore>
}) => {
  render(
    <Provider store={store}>
      <MusicMatchRunResults
        files={files}
        jobId="job-1"
        sourcePath={sourcePath}
        stepId="step-1"
      />
    </Provider>,
  )
  return store
}

describe("isMusicMatchCluster", () => {
  test("recognises a cluster record and rejects anything else on the stream", () => {
    expect(
      isMusicMatchCluster({
        album: "Long Way Down",
        albumArtist: "Harbour Lights",
        files: [],
        isMusicMatch: true,
      }),
    ).toBe(true)
    expect(
      isMusicMatchCluster({ oldName: "a", newName: "b" }),
    ).toBe(false)
    expect(isMusicMatchCluster(null)).toBe(false)
    expect(isMusicMatchCluster("cluster")).toBe(false)
  })
})

describe("findMusicMatchClusters", () => {
  test("picks the cluster records out of a mixed results stream", () => {
    expect(
      findMusicMatchClusters([
        { newName: "b", oldName: "a" },
        {
          album: "Long Way Down",
          albumArtist: "Harbour Lights",
          files: [],
          isMusicMatch: true,
          trackCount: 0,
        },
      ]),
    ).toHaveLength(1)
  })

  test("a missing results array is an empty list, not a throw", () => {
    expect(findMusicMatchClusters(null)).toEqual([])
    expect(findMusicMatchClusters(undefined)).toEqual([])
  })
})

describe("flattenMusicMatchFiles", () => {
  test("the modal takes one flat row set across every cluster", () => {
    expect(
      flattenMusicMatchFiles([
        {
          album: "One",
          albumArtist: "A",
          files: [buildFile({ filename: "01.flac" })],
          isMusicMatch: true,
          trackCount: 1,
        },
        {
          album: "Two",
          albumArtist: "B",
          files: [buildFile({ filename: "02.flac" })],
          isMusicMatch: true,
          trackCount: 1,
        },
      ]),
    ).toHaveLength(2)
  })
})

describe("countMusicMatchFiles", () => {
  test("a file with no candidates counts as unmatched", () => {
    expect(
      countMusicMatchFiles([
        buildFile({ filename: "01.flac" }),
        buildFile({ confidence: 0, filename: "02.flac" }),
      ]),
    ).toEqual({
      fileCount: 2,
      matchedFileCount: 1,
      unmatchedFileCount: 1,
    })
  })
})

describe("dropAppliedMusicMatchFiles", () => {
  test("a row whose tags were already written is not offered again", () => {
    expect(
      dropAppliedMusicMatchFiles({
        appliedFilePaths: ["/inbox/01.flac"],
        files: [
          buildFile({ filename: "01.flac" }),
          buildFile({ filename: "02.flac" }),
        ],
      }).map((file) => file.filename),
    ).toEqual(["02.flac"])
  })

  test("nothing applied yet returns the rows untouched", () => {
    const files = [buildFile({ filename: "01.flac" })]
    expect(
      dropAppliedMusicMatchFiles({
        appliedFilePaths: [],
        files,
      }),
    ).toBe(files)
  })
})

describe("MusicMatchRunResults", () => {
  test("renders nothing at all when the run produced no rows", () => {
    renderPanel({ files: [] })

    expect(
      document.querySelector("#music-match-run-results"),
    ).toBeNull()
  })

  test("reports how many files matched and how many did not", () => {
    renderPanel({
      files: [
        buildFile({ filename: "01.flac" }),
        buildFile({ confidence: 0, filename: "02.flac" }),
      ],
    })

    expect(
      screen.getByText(
        /2 audio files\. 1 matched a release, 1 did not\./,
      ),
    ).toBeVisible()
  })

  test("names the files that matched nothing, so the user knows which before opening the table", () => {
    renderPanel({
      files: [
        buildFile({ filename: "01.flac" }),
        buildFile({
          confidence: 0,
          filename: "99 - hidden.flac",
        }),
      ],
    })

    expect(
      screen.getByText("99 - hidden.flac"),
    ).toBeVisible()
    expect(screen.queryByText("01.flac")).toBeNull()
  })

  test("the trigger seeds the tag review table with the run's rows", async () => {
    const store = renderPanel({
      files: [buildFile({ filename: "01.flac" })],
    })

    await userEvent.click(
      screen.getByRole("button", { name: /Review Tags/ }),
    )

    expect(store.get(tagMatchModalAtom)).toMatchObject({
      jobId: "job-1",
      sourcePath: "/inbox",
      stepId: "step-1",
    })
    expect(
      store.get(tagMatchModalAtom)?.files,
    ).toHaveLength(1)
  })

  // The modal commits per-file absolute paths, so a run with no resolved
  // source folder must not offer a button that fails on click.
  test("with no source path the counts still show and the trigger is gone", () => {
    renderPanel({
      files: [buildFile({ filename: "01.flac" })],
      sourcePath: null,
    })

    expect(
      screen.getByText(/1 audio files\./),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", {
        name: /Review Tags/,
      }),
    ).toBeNull()
  })
})
