import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadModalOpenAtom } from "../state/uiAtoms";
import { stepsAtom } from "../state/stepsAtom";
import { pathsAtom } from "../state/pathsAtom";
import { LoadModal } from "./LoadModal";
import type { Commands } from "../types";

// Minimal COMMANDS fixture — one command with one field
const mockCommands: Commands = {
  testCommand: {
    fields: [{ name: "inputPath", type: "path" }],
  },
};

const minimalYaml = `
- command: testCommand
  params:
    inputPath: /some/path
`.trim();

const canonicalYaml = `
paths:
  basePath:
    label: basePath
    value: /home/user
steps:
  - command: testCommand
    id: step1
    params:
      inputPath: /some/path
`.trim();

// Wraps the component with an isolated Jotai store so tests don't bleed state.
const renderModal = (initialOpen = false) => {
  const store = createStore();
  store.set(loadModalOpenAtom, initialOpen);

  render(
    <Provider store={store}>
      <LoadModal />
    </Provider>,
  );

  return store;
};

beforeEach(() => {
  window.mediaTools = {
    COMMANDS: mockCommands,
    renderAll: vi.fn(),
    updateUrl: vi.fn(),
    kickReverseLookups: vi.fn(),
    kickTmdbResolutions: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Visibility ───────────────────────────────────────────────────────────────

describe("LoadModal visibility", () => {
  it("renders nothing when the atom is false", () => {
    renderModal(false);
    expect(screen.queryByText("Load YAML")).toBeNull();
  });

  it("renders the modal when the atom is true", () => {
    renderModal(true);
    expect(screen.getByText("Load YAML")).toBeInTheDocument();
  });
});

// ─── Close interactions ───────────────────────────────────────────────────────

describe("LoadModal close interactions", () => {
  it("close button hides the modal", async () => {
    const user = userEvent.setup();
    renderModal(true);

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByText("Load YAML")).toBeNull();
  });

  it("clicking the backdrop hides the modal", () => {
    renderModal(true);

    fireEvent.click(screen.getByTestId("load-modal-backdrop"));

    expect(screen.queryByText("Load YAML")).toBeNull();
  });

  it("clicking inside the panel does not close the modal", async () => {
    const user = userEvent.setup();
    renderModal(true);

    // Click the instructional text — this is inside the panel, not the backdrop
    await user.click(screen.getByText(/paste your saved sequence/i));

    expect(screen.getByText("Load YAML")).toBeInTheDocument();
  });

  it("Esc key hides the modal", async () => {
    const user = userEvent.setup();
    renderModal(true);

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Load YAML")).toBeNull();
  });
});

// ─── Paste handling ───────────────────────────────────────────────────────────

describe("LoadModal paste handling", () => {
  it("valid YAML paste loads steps and closes modal", async () => {
    const store = renderModal(true);

    fireEvent.paste(document, {
      clipboardData: { getData: () => minimalYaml },
    });

    const steps = store.get(stepsAtom);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ command: "testCommand" });
    expect(screen.queryByText("Load YAML")).toBeNull();
    expect(window.mediaTools.renderAll).toHaveBeenCalled();
    expect(window.mediaTools.updateUrl).toHaveBeenCalled();
  });

  it("canonical YAML with paths section loads paths correctly", async () => {
    const store = renderModal(true);

    fireEvent.paste(document, {
      clipboardData: { getData: () => canonicalYaml },
    });

    const paths = store.get(pathsAtom);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ id: "basePath", value: "/home/user" });
  });

  it("empty paste is ignored; modal stays open", () => {
    renderModal(true);

    fireEvent.paste(document, {
      clipboardData: { getData: () => "   " },
    });

    expect(screen.getByText("Load YAML")).toBeInTheDocument();
  });

  it("invalid YAML shows an error message and keeps modal open", () => {
    renderModal(true);

    fireEvent.paste(document, {
      clipboardData: { getData: () => "not: valid: yaml: {{{{" },
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Load YAML")).toBeInTheDocument();
  });

  it("unknown command in YAML shows an error message", () => {
    renderModal(true);

    fireEvent.paste(document, {
      clipboardData: {
        getData: () => "- command: unknownCommand\n  params: {}",
      },
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/unknown command/i)).toBeInTheDocument();
  });

  it("paste after modal closes is ignored", () => {
    const store = renderModal(true);

    // Close the modal
    store.set(loadModalOpenAtom, false);

    // Attempt paste — listener should be detached
    fireEvent.paste(document, {
      clipboardData: { getData: () => minimalYaml },
    });

    expect(store.get(stepsAtom)).toHaveLength(0);
  });
});
