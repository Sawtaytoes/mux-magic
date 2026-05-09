import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { apiRunModalAtom, runningAtom } from "../state/uiAtoms";
import { ApiRunModal } from "./ApiRunModal";

const renderWithStore = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <ApiRunModal />
    </Provider>,
  );

describe("ApiRunModal", () => {
  it("renders nothing when apiRunModalAtom is null", () => {
    const store = createStore();
    renderWithStore(store);
    expect(screen.queryByText("Run Sequence")).toBeNull();
  });

  it("renders the modal when a job is set", () => {
    const store = createStore();
    store.set(apiRunModalAtom, {
      jobId: "job-99",
      status: "running",
      logs: [],
      childJobId: null,
      childStepId: null,
    });
    renderWithStore(store);
    expect(screen.getByText("Run Sequence")).toBeInTheDocument();
    expect(screen.getByText("job job-99")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("shows Cancel button when status is running", () => {
    const store = createStore();
    store.set(apiRunModalAtom, {
      jobId: "job-1",
      status: "running",
      logs: [],
      childJobId: null,
      childStepId: null,
    });
    renderWithStore(store);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("hides Cancel button when status is completed", () => {
    const store = createStore();
    store.set(apiRunModalAtom, {
      jobId: "job-1",
      status: "completed",
      logs: [],
      childJobId: null,
      childStepId: null,
    });
    renderWithStore(store);
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("closes the modal when the ✕ button is clicked", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const store = createStore();
    store.set(apiRunModalAtom, {
      jobId: "job-2",
      status: "completed",
      logs: [],
      childJobId: null,
      childStepId: null,
    });
    renderWithStore(store);
    await userEvent.click(screen.getByTitle("Close"));
    expect(store.get(apiRunModalAtom)).toBeNull();
    fetchSpy.mockRestore();
  });

  it("clears runningAtom when closed", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const store = createStore();
    store.set(runningAtom, true);
    store.set(apiRunModalAtom, {
      jobId: "job-3",
      status: "completed",
      logs: [],
      childJobId: null,
      childStepId: null,
    });
    renderWithStore(store);
    await userEvent.click(screen.getByTitle("Close"));
    expect(store.get(runningAtom)).toBe(false);
    fetchSpy.mockRestore();
  });
});
