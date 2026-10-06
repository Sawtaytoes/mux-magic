// One-off script to seed test fixtures and warm caches from real AniDB
// responses.
//
// Run with:   pnpm seed-anidb-fixtures  (from repo root)
//
// What it does:
//   1. Triggers loadAnimeIndex() once  → downloads the manami dataset to
//      <ANIDB_CACHE_FOLDER>/manami/ if upstream has a new version. The dataset itself
//      isn't copied into committed fixtures (it's 60+ MB and weekly-rotating);
//      the test fixture under packages/api/src/tools/__fixtures__/manami/
//      is a small hand-crafted JSON with the same shape.
//   2. Calls lookupAnidbById() for two aids → stores each answer in the
//      provider cache (`provider-cache.sqlite`, provider `aniDb`).
//   3. Writes that XML into packages/api/src/tools/__fixtures__/anidb/anime/
//      so unit tests load real shapes without making network requests.
//      getAnimeXml() is inside AniDB's one-day window here, so it reads the
//      stored answer and makes no second request.
//
// Re-run when AniDB changes a response shape, or to refresh a stale cache.

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { getAnimeXml } from "@mux-magic/core/src/tools/anidbApi.js"
import { loadAnimeIndex } from "@mux-magic/core/src/tools/animeOfflineDatabase.js"
import {
  ANIDB_CLIENT_IDENTIFIERS,
  lookupAnidbById,
} from "@mux-magic/core/src/tools/searchAnidb.js"
import { firstValueFrom } from "rxjs"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(
  scriptDir,
  "..",
  "src",
  "tools",
  "__fixtures__",
  "anidb",
)

// Aids chosen to cover both shape variants in the parser:
//   7206  — small, regular episodes only
//   11370 — has type=6 (O-prefixed) director's-cut episodes alongside regulars
const AIDS = [7206, 11370]

const main = async () => {
  console.log(
    "> loadAnimeIndex() (downloads manami dataset if upstream changed)",
  )
  const index = await loadAnimeIndex()
  console.log(
    `  ${index.length} anime entries with AniDB ids`,
  )

  for (const aid of AIDS) {
    console.log(`> lookupAnidbById(${aid})`)
    const anime = await firstValueFrom(lookupAnidbById(aid))
    console.log(
      `  episodes=${anime?.episodes.length} titles=${anime?.titles.length}`,
    )
  }

  await mkdir(join(FIXTURES_DIR, "anime"), {
    recursive: true,
  })

  for (const aid of AIDS) {
    const dst = join(FIXTURES_DIR, "anime", `${aid}.xml`)
    await writeFile(
      dst,
      await getAnimeXml(aid, ANIDB_CLIENT_IDENTIFIERS),
    )
    console.log(`  wrote ${dst}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
