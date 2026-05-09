import { type Observable } from "rxjs"

import { fastBatchRenameScenario } from "./fastBatchRename.js"

const pad2 = (n: number) => String(n).padStart(2, "0")
const pad3 = (n: number) => String(n).padStart(3, "0")

// ─── renameDemos ─────────────────────────────────────────────────────────────

const DEMO_STYLES = [
  "4K HDR Demo",
  "Dolby Vision Demo",
  "Atmos Showcase",
  "HDR10+ Demo",
  "DTS:X Demo",
  "Auro-3D Demo",
  "HDR Highlights",
  "Reference Quality Demo",
]

const demosItems = Array.from({ length: 100 }, (_, i) => ({
  source: `demo_clip_${pad3(i + 1)}.mkv`,
  destination: `${DEMO_STYLES[i % DEMO_STYLES.length]} ${pad3(i + 1)}.mkv`,
}))

export const renameDemosScenario = (
  _body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => (
  fastBatchRenameScenario(demosItems, {
    label: options.label ?? "fake/renameDemos",
    totalMs: 280,
  })
)

// ─── renameMovieClipDownloads ─────────────────────────────────────────────────

const CLIP_TITLES = [
  "The Matrix", "Inception", "Interstellar", "Blade Runner 2049",
  "Dune", "Avatar", "Top Gun Maverick", "Everything Everywhere All at Once",
  "The Batman", "John Wick",
]

const movieClipItems = Array.from({ length: 100 }, (_, i) => {
  const title = CLIP_TITLES[i % CLIP_TITLES.length]
  const slug = title.toLowerCase().replace(/\s+/g, ".")
  return {
    source: `${slug}.clip.${pad3(i + 1)}.1080p.BluRay.x264.mkv`,
    destination: `${title} - Clip ${pad3(i + 1)}.mkv`,
  }
})

export const renameMovieClipDownloadsScenario = (
  _body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => (
  fastBatchRenameScenario(movieClipItems, {
    label: options.label ?? "fake/renameMovieClipDownloads",
    totalMs: 280,
  })
)

// ─── nameAnimeEpisodes (MAL) ──────────────────────────────────────────────────

const FMA_TITLES = [
  "Fullmetal Alchemist", "The First Day", "City of Heresy",
  "An Alchemist's Anguish", "Rain of Sorrows", "Road of Hope",
  "Hidden Truths", "The Fifth Laboratory", "Created Feelings",
  "The Dog of the Military's Silver Watch", "Miracle at Rush Valley",
  "One is All, All is One", "Beasts of Dublith", "Those Who Lurk Underground",
  "Envoy from the East", "Footsteps of a Comrade-in-Arms", "Cold Flames",
  "The Arrogant Palm of a Small Human", "Death of the Undying",
  "Father Before the Grave", "Advance of the Fool", "Backs in the Distance",
  "Girl on the Battlefield", "Inside the Belly",
]

const animeItems = FMA_TITLES.map((title, i) => ({
  source: `[HorribleSubs] Fullmetal Alchemist Brotherhood - ${pad2(i + 1)} [1080p].mkv`,
  destination: `Fullmetal Alchemist Brotherhood S01E${pad2(i + 1)} - ${title}.mkv`,
}))

export const nameAnimeEpisodesScenario = (
  _body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => (
  fastBatchRenameScenario(animeItems, {
    label: options.label ?? "fake/nameAnimeEpisodes",
    totalMs: 700,
  })
)

// ─── nameAnimeEpisodesAniDB ───────────────────────────────────────────────────

const BEBOP_TITLES = [
  "Asteroid Blues", "Stray Dog Strut", "Honky Tonk Women",
  "Gateway Shuffle", "Ballad of Fallen Angels", "Sympathy for the Devil",
  "Heavy Metal Queen", "Waltz for Venus", "Jamming with Edward",
  "Ganymede Elegy", "Toys in the Attic", "Jupiter Jazz Part I",
  "Jupiter Jazz Part II", "Bohemian Rhapsody", "My Funny Valentine",
  "Black Dog Serenade", "Mushroom Samba", "Speak Like a Child",
  "Wild Horses", "Pierrot le Fou", "Boogie Woogie Feng Shui",
  "Cowboy Funk", "Brain Scratch", "Hard Luck Woman",
  "The Real Folk Blues Part I", "The Real Folk Blues Part II",
]

const anidbItems = BEBOP_TITLES.map((title, i) => ({
  source: `[Commie] Cowboy Bebop - ${pad2(i + 1)} [BD][1080p FLAC].mkv`,
  destination: `Cowboy Bebop E${pad2(i + 1)} - ${title}.mkv`,
}))

export const nameAnimeEpisodesAniDBScenario = (
  _body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => (
  fastBatchRenameScenario(anidbItems, {
    label: options.label ?? "fake/nameAnimeEpisodesAniDB",
    totalMs: 700,
  })
)

// ─── nameTvShowEpisodes (TVDB) ────────────────────────────────────────────────

const BUFFY_TITLES = [
  "Welcome to the Hellmouth", "The Harvest", "Witch",
  "Teacher's Pet", "Never Kill a Boy on the First Date",
  "The Pack", "Angel", "I Robot, You Jane",
  "The Puppet Show", "Nightmares", "Out of Mind, Out of Sight",
  "Prophecy Girl",
]

const tvItems = BUFFY_TITLES.map((title, i) => ({
  source: `s01e${pad2(i + 1)}.mkv`,
  destination: `Buffy the Vampire Slayer S01E${pad2(i + 1)} - ${title}.mkv`,
}))

export const nameTvShowEpisodesScenario = (
  _body: unknown,
  options: { label?: string } = {},
): Observable<unknown> => (
  fastBatchRenameScenario(tvItems, {
    label: options.label ?? "fake/nameTvShowEpisodes",
    totalMs: 600,
  })
)
