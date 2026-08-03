// AniDB title-picker fetch: given an aid, fetch every candidate title
// AniDB carries for the anime so the user can pick one, then character-
// clean it in the free-text input. Backed by POST /queries/lookupAnidbTitles
// (see queryRoutes.ts) — the synthetic (aXXXXX) reference form is already
// filtered server-side.

import type {
  AnidbTitle,
  LookupAnidbTitlesResponse,
} from "@mux-magic/api/api-types"
import { apiBase } from "../../apiBase"

export const fetchAnidbTitles = async (
  anidbId: number,
): Promise<AnidbTitle[]> => {
  try {
    const response = await fetch(
      `${apiBase}/queries/lookupAnidbTitles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anidbId }),
      },
    )
    if (!response.ok) return []
    const data =
      (await response.json()) as LookupAnidbTitlesResponse
    return data.titles ?? []
  } catch {
    return []
  }
}
