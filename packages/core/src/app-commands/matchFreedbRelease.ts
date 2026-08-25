import { FREEDB_CDDB_SERVER } from "../tools/cddbApi.js"
import { freedbCddbCachedFetch } from "../tools/musicProviderFetchers.js"
import {
  type MatchVgmdbReleaseProps,
  matchCddbRelease,
} from "./matchVgmdbRelease.js"

// The THIRD fallback, and only that.
//
// The order the owner settled: MusicBrainz first, VGMdb second for game
// and anime soundtracks, and general freedb for what neither of them has
// ever heard of. freedb is last on purpose — it is user-submitted CD
// metadata with no editorial review, so its titles are frequently
// abbreviated, mis-cased or plain wrong, and it carries no artist ids,
// no recording ids and no release ids to link back to.
//
// It is worth having anyway, because the discs it does know are exactly
// the ones the other two miss: obscure pressings, regional releases and
// old commercial CDs nobody ever added to MusicBrainz.
//
// Identical machinery to `matchVgmdbRelease` — same protocol, same disc
// id, same review table. Only the server and the label differ, which is
// why they share one implementation.

export type MatchFreedbReleaseProps = Omit<
  MatchVgmdbReleaseProps,
  "language"
>

export const matchFreedbRelease = (
  props: MatchFreedbReleaseProps,
) =>
  matchCddbRelease({
    ...props,
    cachedFetch: props.cachedFetch ?? freedbCddbCachedFetch,
    // ⚠️ No language option, unlike VGMdb. General freedb serves one
    // language per entry — whoever submitted the disc chose it — and
    // has no language paths to ask on.
    language: "default",
    server: FREEDB_CDDB_SERVER,
    sourceLabel: "freedb",
  })
