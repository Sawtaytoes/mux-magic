import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { COMMANDS } from "../../commands/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
} from "../../types"
import { BuilderPage } from "./BuilderPage"

// BuilderPage calls useHydrateAtoms([[commandsAtom, COMMANDS]]) on mount,
// so commandsAtom is always populated. We only need to pre-seed step/path data.

const withStore = (
  steps: SequenceItem[] = [],
  paths: PathVariable[] = [
    {
      id: "basePath",
      label: "basePath",
      value: "",
      type: "path",
    },
  ],
) => {
  const store = createStore()
  store.set(commandsAtom, COMMANDS)
  store.set(stepsAtom, steps)
  store.set(pathsAtom, paths)

  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof BuilderPage> = {
  title: "Pages/BuilderPage",
  component: BuilderPage,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof BuilderPage>

// ─── Empty state ──────────────────────────────────────────────────────────────

export const Empty: Story = {
  decorators: [withStore()],
}

// ─── Mid-edit: two steps, one path var ───────────────────────────────────────

export const MidEdit: Story = {
  decorators: [
    withStore(
      [
        {
          id: "step1",
          alias: "Find anime files",
          command: "nameAnimeEpisodes",
          params: { sourcePath: "@basePath", malId: 39534 },
          links: { sourcePath: "basePath" },
          status: null,
          error: null,
          isCollapsed: false,
        },
        {
          id: "step2",
          alias: "",
          command: "addSubtitles",
          params: { sourcePath: "@basePath" },
          links: { sourcePath: "basePath" },
          status: null,
          error: null,
          isCollapsed: false,
        },
      ],
      [
        {
          id: "basePath",
          label: "basePath",
          value: "/media/anime",
          type: "path" as const,
        },
      ],
    ),
  ],
}

// ─── Full pipeline: multi-step sequence with group ───────────────────────────
// Based on the nameAnimeEpisodes → modifySubtitleMetadata → addSubtitles chain
// from the parity fixtures. Closest thing to a real-world scenario in the UI.

export const FullPipeline: Story = {
  decorators: [
    withStore(
      [
        {
          id: "step1",
          alias: "Name episodes",
          command: "nameAnimeEpisodes",
          params: {
            sourcePath: "@basePath",
            malId: 39534,
            malName: "Violet Evergarden",
            seasonNumber: 2,
          },
          links: { sourcePath: "basePath" },
          status: "completed",
          error: null,
          isCollapsed: true,
        },
        {
          kind: "group",
          id: "group_parallel",
          label: "Subtitle processing (parallel)",
          isParallel: true,
          isCollapsed: false,
          steps: [
            {
              id: "step2",
              alias: "Modify subs",
              command: "modifySubtitleMetadata",
              params: { sourcePath: "@basePath" },
              links: { sourcePath: "basePath" },
              status: "completed",
              error: null,
              isCollapsed: false,
            },
            {
              id: "step3",
              alias: "Extract subs",
              command: "extractSubtitles",
              params: { sourcePath: "@basePath" },
              links: { sourcePath: "basePath" },
              status: null,
              error: null,
              isCollapsed: false,
            },
          ],
        },
        {
          id: "step4",
          alias: "Add subtitles",
          command: "addSubtitles",
          params: { sourcePath: "@basePath" },
          links: { sourcePath: "basePath" },
          status: null,
          error: null,
          isCollapsed: false,
        },
        {
          id: "step5",
          alias: "Move to final",
          command: "moveFiles",
          params: { sourcePath: "@basePath" },
          links: { sourcePath: "basePath" },
          status: null,
          error: null,
          isCollapsed: false,
        },
      ],
      [
        {
          id: "basePath",
          label: "basePath",
          value: "/media/anime/violet-evergarden",
          type: "path" as const,
        },
      ],
    ),
  ],
}

// ─── Step with run status ─────────────────────────────────────────────────────

export const StepRunning: Story = {
  decorators: [
    withStore(
      [
        {
          id: "step1",
          alias: "Running step",
          command: "nameAnimeEpisodes",
          params: { sourcePath: "@basePath", malId: 12345 },
          links: { sourcePath: "basePath" },
          status: "running",
          error: null,
          isCollapsed: false,
        },
        {
          id: "step2",
          alias: "Completed step",
          command: "addSubtitles",
          params: { sourcePath: "@basePath" },
          links: { sourcePath: "basePath" },
          status: "completed",
          error: null,
          isCollapsed: true,
        },
        {
          id: "step3",
          alias: "Failed step",
          command: "extractSubtitles",
          params: { sourcePath: "@basePath" },
          links: { sourcePath: "basePath" },
          status: "failed",
          error: "ENOENT: /media/anime not found",
          isCollapsed: false,
        },
      ],
      [
        {
          id: "basePath",
          label: "basePath",
          value: "/media/anime",
          type: "path" as const,
        },
      ],
    ),
  ],
}
