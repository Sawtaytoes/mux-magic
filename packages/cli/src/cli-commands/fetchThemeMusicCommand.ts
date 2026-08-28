import { fetchThemeMusic } from "@mux-magic/core/src/app-commands/fetchThemeMusic.js"
import { subscribeCli } from "@mux-magic/core/src/tools/subscribeCli.js"
import type {
  Argv,
  CommandBuilder,
  CommandModule,
} from "yargs"

type InferArgvOptions<T> =
  T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) =>
  yargs
    .example(
      '$0 fetchThemeMusic "G:\\Anime"',
      "Creates a reviewable AnimeThemes manifest. It does not write theme.mp3 files.",
    )
    .example(
      '$0 fetchThemeMusic "G:\\Anime" --apply',
      "Downloads and transcodes each resolved opening into its show folder after manifest review.",
    )
    .positional("sourcePath", {
      demandOption: true,
      describe:
        "Anime library root, or one [anidb-#####] show folder.",
      type: "string",
    })
    .option("isApplied", {
      alias: "apply",
      boolean: true,
      default: false,
      describe:
        "Write theme.mp3 files. Without this flag, only the manifest is written.",
      type: "boolean",
    })
    .option("isOverwrite", {
      alias: "overwrite",
      boolean: true,
      default: true,
      describe:
        "Replace an existing theme.mp3 only when AnimeThemes resolves a replacement.",
      type: "boolean",
    })
    .option("manifestPath", {
      describe:
        "Path for the JSON review manifest. Defaults to <sourcePath>/theme-music-manifest.json.",
      type: "string",
    })

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const fetchThemeMusicCommand: CommandModule<
  Record<string, unknown>,
  Args
> = {
  command: "fetchThemeMusic <sourcePath>",
  describe:
    "Resolve AniDB-tagged anime folders through AnimeThemes and create Plex-compatible theme.mp3 files.",
  builder: builder as CommandBuilder<
    Record<string, unknown>,
    Args
  >,
  handler: (argv) => {
    fetchThemeMusic({
      isApplied: argv.isApplied,
      isOverwrite: argv.isOverwrite,
      manifestPath: argv.manifestPath,
      sourcePath: argv.sourcePath,
    }).subscribe(subscribeCli())
  },
}
