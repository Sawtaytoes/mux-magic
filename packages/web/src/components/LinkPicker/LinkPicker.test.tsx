import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import type { Commands } from "../../commands/types"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { PathVariable, Step } from "../../types"
import { LinkPicker } from "./LinkPicker"

const makeStep = (id: string, command: string): Step => ({
  id,
  alias: "",
  command,
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const makePath = (
  id: string,
  label: string,
  value: string,
): PathVariable => ({
  id,
  label,
  value,
  type: "path",
})

type Setup = {
  steps?: Step[]
  paths?: PathVariable[]
  commands?: Commands
  stepId: string
  fieldName: string
}

const renderPicker = ({
  steps = [
    makeStep("step-1", "copyFiles"),
    makeStep("step-2", "moveFiles"),
    makeStep("step-3", "addSubtitles"),
  ],
  paths = [
    makePath("basePath", "Base Path", "/home/user/videos"),
    makePath(
      "outputPath",
      "Output Path",
      "/home/user/output",
    ),
  ],
  commands,
  stepId,
  fieldName,
}: Setup) => {
  const store = createStore()
  store.set(stepsAtom, steps)
  store.set(pathsAtom, paths)
  if (commands) {
    store.set(commandsAtom, commands)
  }
  render(
    <Provider store={store}>
      <LinkPicker
        stepId={stepId}
        fieldName={fieldName}
        label="— custom —"
      />
    </Provider>,
  )
  return store
}

const openPicker = async (
  user: ReturnType<typeof userEvent.setup>,
) => {
  await user.click(
    screen.getByTitle(
      "Link to a path variable or step output",
    ),
  )
}

afterEach(() => {
  cleanup()
})

describe("LinkPicker visibility", () => {
  test("renders nothing until the trigger is clicked", async () => {
    const user = userEvent.setup()
    renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    expect(screen.queryByRole("listbox")).toBeNull()
    await openPicker(user)
    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })

  test("shows footer hint text", async () => {
    const user = userEvent.setup()
    renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    expect(
      screen.getByText(
        /Don't see what you need\? Close this and type a path directly/,
      ),
    ).toBeInTheDocument()
  })
})

describe("LinkPicker items", () => {
  test("shows path variables", async () => {
    const user = userEvent.setup()
    renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    expect(
      screen.getByText("Base Path"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Output Path"),
    ).toBeInTheDocument()
  })

  test("shows preceding steps (not the current or later steps)", async () => {
    const user = userEvent.setup()
    renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    // step-3 is the anchor — only step-1 and step-2 should appear
    expect(
      screen.getByText(/Step 1: Copy Files/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Step 2: Move Files/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/addSubtitles/)).toBeNull()
  })

  test("filters items by query", async () => {
    const user = userEvent.setup()
    renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    await user.type(
      screen.getByPlaceholderText(/search locations/i),
      "base",
    )

    expect(
      screen.getByText("Base Path"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Output Path")).toBeNull()
  })
})

describe("LinkPicker selection", () => {
  test("clicking a path var sets the link on the step", async () => {
    const user = userEvent.setup()
    const store = renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    await user.click(screen.getByText("Base Path"))

    const step3 = (store.get(stepsAtom) as Step[]).find(
      (step) => step.id === "step-3",
    )
    expect(step3?.links.sourcePath).toBe("basePath")
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  test("clicking a step item stores the object form, not a display string", async () => {
    const user = userEvent.setup()
    const store = renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    await user.click(screen.getByText(/Step 1: Copy Files/))

    const step3 = (store.get(stepsAtom) as Step[]).find(
      (step) => step.id === "step-3",
    )
    expect(step3?.links.sourcePath).toEqual({
      linkedTo: "step-1",
      output: "folder",
    })
  })
})

describe("LinkPicker keyboard", () => {
  test("Escape closes the picker", async () => {
    const user = userEvent.setup()
    renderPicker({
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).toBeNull()
    })
  })
})

describe("LinkPicker named outputs", () => {
  const commandsWithNamedOutput: Commands = {
    copyFiles: {
      summary: "Copy files",
      tag: "File Operations",
      outputFolderName: "COPY-OUTPUT",
      outputs: [
        {
          name: "copiedSourcePaths",
          label: "Copied source paths",
        },
      ],
      fields: [
        {
          name: "sourcePath",
          type: "path",
          label: "Source Path",
          isRequired: true,
        },
      ],
    },
    deleteCopiedOriginals: {
      summary: "Delete originals",
      tag: "File Operations",
      outputFolderName: null,
      fields: [
        {
          name: "pathsToDelete",
          type: "stringArray",
          label: "Paths to Delete",
          isRequired: true,
        },
      ],
    },
  }

  test("renders one row per named output in addition to the folder row", async () => {
    const user = userEvent.setup()
    renderPicker({
      steps: [
        makeStep("step-1", "copyFiles"),
        makeStep("step-2", "deleteCopiedOriginals"),
      ],
      paths: [],
      commands: commandsWithNamedOutput,
      stepId: "step-2",
      fieldName: "pathsToDelete",
    })

    await openPicker(user)
    expect(
      screen.getByText("Step 1: Copy Files"),
    ).toBeVisible()
    expect(
      screen.getByText(
        /Step 1: Copy Files → Copied source paths/,
      ),
    ).toBeVisible()
  })

  test("acceptedOutputs whitelist hides folder rows and path variables", async () => {
    const user = userEvent.setup()
    const commands: Commands = {
      ...commandsWithNamedOutput,
      deleteCopiedOriginals: {
        ...commandsWithNamedOutput.deleteCopiedOriginals,
        fields: [
          {
            name: "pathsToDelete",
            type: "stringArray",
            label: "Paths to Delete",
            isRequired: true,
            acceptedOutputs: ["copiedSourcePaths"],
          },
        ],
      },
    }
    renderPicker({
      steps: [
        makeStep("step-1", "copyFiles"),
        makeStep("step-2", "deleteCopiedOriginals"),
      ],
      paths: [
        makePath(
          "basePath",
          "Base Path",
          "/home/user/videos",
        ),
      ],
      commands,
      stepId: "step-2",
      fieldName: "pathsToDelete",
    })

    await openPicker(user)
    expect(screen.queryByText("Base Path")).toBeNull()
    expect(
      screen.queryByText("Step 1: Copy Files"),
    ).toBeNull()
    expect(
      screen.getByText(
        /Step 1: Copy Files → Copied source paths/,
      ),
    ).toBeVisible()
    expect(
      screen.queryByText(
        /type a path directly into the field/,
      ),
    ).toBeNull()
  })

  test("clicking the named-output row writes that output name to the link", async () => {
    const user = userEvent.setup()
    const store = renderPicker({
      steps: [
        makeStep("step-1", "copyFiles"),
        makeStep("step-2", "deleteCopiedOriginals"),
      ],
      paths: [],
      commands: commandsWithNamedOutput,
      stepId: "step-2",
      fieldName: "pathsToDelete",
    })

    await openPicker(user)
    await user.click(
      screen.getByText(
        /Step 1: Copy Files → Copied source paths/,
      ),
    )

    const step2 = (store.get(stepsAtom) as Step[]).find(
      (step) => step.id === "step-2",
    )
    expect(step2?.links.pathsToDelete).toEqual({
      linkedTo: "step-1",
      output: "copiedSourcePaths",
    })
  })
})

describe("LinkPicker step detail", () => {
  test("step item shows computed output path as detail when commands are loaded", async () => {
    const user = userEvent.setup()
    renderPicker({
      steps: [
        makeStep("step-1", "copyFiles"),
        makeStep("step-3", "addSubtitles"),
      ],
      paths: [
        makePath(
          "basePath",
          "Base Path",
          "/home/user/videos",
        ),
      ],
      commands: {
        copyFiles: {
          summary: "Copy files",
          tag: "File Operations",
          outputFolderName: "COPY-OUTPUT",
          fields: [
            {
              name: "sourcePath",
              type: "path",
              label: "Source Path",
              isRequired: true,
            },
          ],
        },
      },
      stepId: "step-3",
      fieldName: "sourcePath",
    })

    await openPicker(user)
    expect(
      screen.getByText("COPY-OUTPUT"),
    ).toBeInTheDocument()
  })
})
