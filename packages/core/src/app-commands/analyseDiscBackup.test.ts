import { join } from "node:path"

import { vol } from "memfs"
import { firstValueFrom, of } from "rxjs"
import { describe, expect, test, vi } from "vitest"

import { runMakeMkvCon } from "../cli-spawn-operations/runMakeMkvCon.js"
import { parseTitleGraph } from "../tools/makemkv/parseTitleGraph.js"
import {
  analyseDiscBackup,
  discAnalysisFileName,
  discAnalysisFolderName,
} from "./analyseDiscBackup.js"

// vitest.setup.ts mocks node:fs with memfs and auto-mocks every
// cli-spawn-operation, so this exercises the real analyser against a real
// robot-mode capture without spawning makemkvcon.
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(
  import.meta.dirname,
  "..",
  "tools",
  "makemkv",
  "__fixtures__",
)
const loadGraph = (fixtureName: string) =>
  parseTitleGraph(
    realFs.readFileSync(
      join(FIXTURES_DIR, fixtureName),
      "utf8",
    ),
  )

const sourcePath = "/media/Disc-Rips/[BACKUP] Soylent"

describe(analyseDiscBackup.name, () => {
  test("emits a proposal per title and writes the DISC-ANALYSIS sidecar", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("soylent-green-uhd.robot.log")),
    )

    const analysis = await firstValueFrom(
      analyseDiscBackup({ sourcePath }),
    )

    expect(analysis.titles).toHaveLength(18)

    const writtenSidecar = JSON.parse(
      String(
        vol.readFileSync(
          join(
            sourcePath,
            discAnalysisFolderName,
            discAnalysisFileName,
          ),
          "utf8",
        ),
      ),
    ) as { titles: unknown[] }

    expect(writtenSidecar.titles).toHaveLength(18)
  })

  test("passes --minlength=0 through by default so short extras are seen", async () => {
    // MakeMKV's 10-second floor drops 51 of Desk Set's 61 titles. "Propose,
    // never silently discard" means the analyser has to see them.
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("desk-set-bluray.robot.log")),
    )

    await firstValueFrom(analyseDiscBackup({ sourcePath }))

    expect(runMakeMkvCon).toHaveBeenCalledWith({
      minimumTitleLengthSeconds: 0,
      sourcePath,
    })
  })

  test("forwards disabled rule names to the analyser", async () => {
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("soylent-green-uhd.robot.log")),
    )

    const analysis = await firstValueFrom(
      analyseDiscBackup({
        disabledRuleNames: ["isTrackSetVariant"],
        sourcePath,
      }),
    )

    expect(
      analysis.verdicts.some(
        (verdict) =>
          verdict.ruleName === "isTrackSetVariant",
      ),
    ).toBe(false)
  })

  test("never writes into the backup outside the DISC-ANALYSIS folder", async () => {
    // The backup is not modified by analysis — it is read-only input.
    vi.mocked(runMakeMkvCon).mockReturnValue(
      of(loadGraph("troy-theatrical-cut-uhd.robot.log")),
    )

    await firstValueFrom(analyseDiscBackup({ sourcePath }))

    expect(vol.readdirSync(sourcePath)).toEqual([
      discAnalysisFolderName,
    ])
  })
})
