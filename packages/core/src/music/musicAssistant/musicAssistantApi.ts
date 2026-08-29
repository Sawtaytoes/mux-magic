export type MusicAssistantFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "json" | "ok" | "status">>

type MusicAssistantProviderMapping = {
  audio_format?: {
    bit_depth?: number
    codec_type?: string
    sample_rate?: number
  }
  in_library?: boolean
  provider_instance?: string
}

type MusicAssistantAlbum = {
  item_id?: string
  name?: string
  provider_mappings?: MusicAssistantProviderMapping[]
  year?: number
}

const throwMissingEnvironmentValue = (
  name: string,
): never => {
  throw new Error(
    `${name} is not set. Configure Music Assistant access in the Mux Magic app environment before running this command.`,
  )
}

const requireEnvironmentValue = (name: string) =>
  process.env[name] || throwMissingEnvironmentValue(name)

const normalizeSearchValue = (value: string) =>
  value.trim().toLocaleLowerCase()

export type MusicAssistantLibraryAlbum = {
  audioFormat: {
    bitDepth: number | null
    codec: string | null
    sampleRate: number | null
  }
  itemId: string
  name: string
  year: number | null
}

export const findMusicAssistantLibraryAlbums = async ({
  albumName,
  fetchImplementation = globalThis.fetch,
}: {
  albumName: string
  fetchImplementation?: MusicAssistantFetch
}): Promise<MusicAssistantLibraryAlbum[]> => {
  const apiUrl = requireEnvironmentValue(
    "MUSIC_ASSISTANT_API_URL",
  )
  const libraryProviderId = requireEnvironmentValue(
    "MUSIC_ASSISTANT_LIBRARY_PROVIDER_ID",
  )
  const token = requireEnvironmentValue(
    "MUX_MAGIC_MUSIC_ASSISTANT_TOKEN",
  )
  const response = await fetchImplementation(apiUrl, {
    body: JSON.stringify({
      command: "music/albums/library_items",
      message_id: `mux-magic-${albumName}`,
      args: { limit: 25, search: albumName },
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(
      `Music Assistant returned HTTP ${response.status} while searching albums.`,
    )
  }

  const albums =
    (await response.json()) as MusicAssistantAlbum[]
  return albums
    .filter(
      (album) =>
        normalizeSearchValue(album.name ?? "") ===
        normalizeSearchValue(albumName),
    )
    .flatMap((album) =>
      (album.provider_mappings ?? [])
        .filter(
          (providerMapping) =>
            providerMapping.in_library === true &&
            providerMapping.provider_instance ===
              libraryProviderId,
        )
        .map(
          (
            providerMapping,
          ): MusicAssistantLibraryAlbum => ({
            audioFormat: {
              bitDepth:
                providerMapping.audio_format?.bit_depth ??
                null,
              codec:
                providerMapping.audio_format?.codec_type ??
                null,
              sampleRate:
                providerMapping.audio_format?.sample_rate ??
                null,
            },
            itemId: album.item_id ?? "",
            name: album.name ?? albumName,
            year: album.year ?? null,
          }),
        ),
    )
}
