import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { lookupModalAtom } from "../../components/LookupModal/lookupModalAtom"
import type { LookupState } from "../../components/LookupModal/types"
import { LookupModal } from "./LookupModal"

const ReOpenButton = ({
  initialState,
}: {
  initialState: LookupState
}) => {
  const setLookup = useSetAtom(lookupModalAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setLookup(initialState)}
      >
        Re-open modal
      </button>
    </div>
  )
}

const empty = {
  companionNameField: null,
  searchTerm: "",
  searchError: null,
  results: null,
  formatFilter: "all",
  selectedGroup: null,
  selectedVariant: null,
  selectedFid: null,
  releases: null,
  releasesDebug: null,
  releasesError: null,
  isLoading: false,
}

const meta: Meta<typeof LookupModal> = {
  title: "Modals/LookupModal",
  component: LookupModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as LookupState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(lookupModalAtom, initialState)
        return newStore
      })
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof LookupModal>

const malSearchState = {
  ...empty,
  lookupType: "mal" as const,
  stepId: "s1",
  fieldName: "malId",
  stage: "search" as const,
} satisfies LookupState

const dvdCompareWithResultsState = {
  ...empty,
  lookupType: "dvdcompare" as const,
  stepId: "s2",
  fieldName: "dvdCompareId",
  stage: "search" as const,
  formatFilter: "Blu-ray 4K",
  results: [
    {
      baseTitle: "Neon Genesis Evangelion",
      year: "1995",
      variants: [
        { id: "fid-1", variant: "Blu-ray 4K" },
        { id: "fid-2", variant: "Blu-ray" },
      ],
    },
    {
      baseTitle: "Evangelion: 1.11 You Are (Not) Alone",
      year: "2009",
      variants: [{ id: "fid-3", variant: "Blu-ray 4K" }],
    },
  ] as never,
} satisfies LookupState

const dvdCompareVariantPickerState = {
  ...empty,
  lookupType: "dvdcompare" as const,
  stepId: "s3",
  fieldName: "dvdCompareId",
  stage: "variant" as const,
  selectedGroup: {
    baseTitle: "Neon Genesis Evangelion",
    year: "1995",
    variants: [
      { id: "fid-1", variant: "Blu-ray 4K" },
      { id: "fid-2", variant: "Blu-ray" },
      { id: "fid-3", variant: "DVD" },
    ],
  },
} satisfies LookupState

export const MalSearch: Story = {
  parameters: { initialState: malSearchState },
  render: () => (
    <>
      <ReOpenButton initialState={malSearchState} />
      <LookupModal />
    </>
  ),
}
export const DvdCompareWithResults: Story = {
  parameters: { initialState: dvdCompareWithResultsState },
  render: () => (
    <>
      <ReOpenButton
        initialState={dvdCompareWithResultsState}
      />
      <LookupModal />
    </>
  ),
}
export const DvdCompareVariantPicker: Story = {
  parameters: {
    initialState: dvdCompareVariantPickerState,
  },
  render: () => (
    <>
      <ReOpenButton
        initialState={dvdCompareVariantPickerState}
      />
      <LookupModal />
    </>
  ),
}
