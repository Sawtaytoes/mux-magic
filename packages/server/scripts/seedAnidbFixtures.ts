// One-off script to seed test fixtures and warm caches from real AniDB
// responses.
//
// Run with:   yarn seed-anidb-fixtures  (from repo root)
//
// What it does:
//   1. Triggers loadAnimeIndex() once  → downloads the manami dataset to
//      <ANIDB_CACHE_FOLDER>/manami/ if it isn't fresh. The dataset itself
//      isn't copied into committed fixtures (it's 60+ MB and weekly-rotating);
//      the test fixture under packages/server/src/tools/__fixtures__/manami/
//      is a small hand-crafted JSON with the same shape.
//   2. Calls lookupAnidbById() for two aids → populates
//      <ANIDB_CACHE_FOLDER>/anime/<aid>.xml from the AniDB HTTP API.
//   3. Copies the cached XML into packages/server/src/tools/__fixtures__/anidb/anime/
//      so unit tests load real shapes without making network requests.
//
// Re-run when AniDB changes a response shape, or to refresh a stale cache.

import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { firstValueFrom } from "rxjs"

import { getAnidbCacheDir } from "../src/tools/getAnidbCacheDir.js"
import { loadAnimeIndex } from "../src/tools/animeOfflineDatabase.js"
import { lookupAnidbById } from "../src/tools/searchAnidb.js"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(scriptDir, "..", "src", "tools", "__fixtures__", "anidb")
const CACHE_DIR = getAnidbCacheDir()

// Aids chosen to cover both shape variants in the parser:
//   7206  — small, regular episodes only
//   11370 — has type=6 (O-prefixed) director's-cut episodes alongside regulars
const AIDS = [7206, 11370]

const main = async () => {
  console.log("> loadAnimeIndex() (downloads manami dataset if stale)")
  const index = await loadAnimeIndex()
  console.log(`  ${index.length} anime entries with AniDB ids`)

  for (const aid of AIDS) {
    console.log(`> lookupAnidbById(${aid})`)
    const anime = await firstValueFrom(lookupAnidbById(aid))
    console.log(`  episodes=${anime?.episodes.length} titles=${anime?.titles.length}`)
  }

  await mkdir(join(FIXTURES_DIR, "anime"), { recursive: true })

  for (const aid of AIDS) {
    const src = join(CACHE_DIR, "anime", `${aid}.xml`)
    const dst = join(FIXTURES_DIR, "anime", `${aid}.xml`)
    await copyFile(src, dst)
    console.log(`  copied ${src} → ${dst}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
