import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { action } from "storybook/actions"
import { Modal } from "./Modal"

const meta: Meta<typeof Modal> = {
  title: "Modals/Modal",
  component: Modal,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof Modal>

const SampleContent = ({
  onClose,
}: {
  onClose: () => void
}) => (
  <div
    className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
    style={{ width: "min(90vw,480px)" }}
  >
    <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
      <span className="text-xs font-medium text-slate-400">
        Example Modal
      </span>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-slate-400 hover:text-slate-200"
      >
        ✕ Close
      </button>
    </div>
    <div className="px-6 py-8 text-center">
      <p className="text-sm text-slate-300">
        Backdrop click or Esc closes this modal.
      </p>
    </div>
  </div>
)

export const Open: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true)
    return (
      <>
        <div className="p-4">
          <button
            type="button"
            className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
            onClick={() => setIsOpen(true)}
          >
            Open modal
          </button>
        </div>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          ariaLabel="Example modal"
        >
          <SampleContent onClose={() => setIsOpen(false)} />
        </Modal>
      </>
    )
  },
}

export const Closed: Story = {
  render: () => (
    <Modal
      isOpen={false}
      onClose={action("onClose")}
      ariaLabel="Closed modal"
    >
      <SampleContent onClose={action("onClose")} />
    </Modal>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "When isOpen is false the component renders nothing.",
      },
    },
  },
}
