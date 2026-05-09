import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { lookupModalAtom } from "../state/uiAtoms"
import { LookupModal } from "./LookupModal"

const empty = {
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
  loading: false,
}

const malStore = createStore()
malStore.set(lookupModalAtom, {
  ...empty,
  lookupType: "mal" as const,
  stepId: "s1",
  fieldName: "malId",
  stage: "search" as const,
})

const dvdStore = createStore()
dvdStore.set(lookupModalAtom, {
  ...empty,
  lookupType: "dvdcompare" as const,
  stepId: "s2",
  fieldName: "dvdCompareId",
  stage: "search" as const,
  formatFilter: "Blu-ray 4K",
  results: [
    { name: "Neon Genesis Evangelion (1995)" } as never,
    { name: "Evangelion: 1.11 You Are (Not) Alone" } as never,
  ],
})

const variantStore = createStore()
variantStore.set(lookupModalAtom, {
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
})

const meta: Meta<typeof LookupModal> = {
  title: "Wave E/LookupModal",
  component: LookupModal,
  decorators: [
    (Story, context) => {
      const store = context.parameters["store"] as ReturnType<typeof createStore>
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

export const MalSearch: Story = { parameters: { store: malStore } }
export const DvdCompareWithResults: Story = { parameters: { store: dvdStore } }
export const DvdCompareVariantPicker: Story = {
  parameters: { store: variantStore },
}
