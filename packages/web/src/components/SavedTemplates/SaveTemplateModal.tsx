import { Button, Dialog } from "@charcuterie/ui"
import { useState } from "react"

import type { StoredTemplate } from "../../state/templatesApi"
import { createTemplate } from "../../state/templatesApi"

type SaveTemplateModalProps = {
  isOpen: boolean
  yaml: string
  onClose: () => void
  onSaved: (template: StoredTemplate) => void
}

// One-shot modal for the "Save current sequence as template" flow.
// Owns its own draft state for name/description; resets via `key` from
// the parent whenever it reopens.
//
// Failure handling: surfaces the server's error text inline so the
// user sees "invalid yaml" (with details) or "Templates API 500: …"
// without losing what they typed.
export const SaveTemplateModal = ({
  isOpen,
  yaml,
  onClose,
  onSaved,
}: SaveTemplateModalProps) => {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return
    if (name.trim().length === 0) {
      setErrorMessage("Name is required.")
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const created = await createTemplate({
        name: name.trim(),
        description:
          description.trim().length > 0
            ? description.trim()
            : undefined,
        yaml,
      })
      onSaved(created)
      setName("")
      setDescription("")
      onClose()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      heading="Save sequence as template"
      isVisible={isOpen}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={onSubmit}>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            className="mt-1 w-full bg-surface-sunken border border-border-default rounded px-3 py-2 text-content-primary"
            placeholder="My workflow"
          />
        </label>

        <label className="block mb-3">
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
            Description (optional)
          </span>
          <textarea
            rows={3}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            className="mt-1 w-full bg-surface-sunken border border-border-default rounded px-3 py-2 text-content-primary"
            placeholder="What this template is for"
          />
        </label>

        {errorMessage !== null && (
          <p
            role="alert"
            className="text-intent-danger-content text-sm mb-3 whitespace-pre-wrap"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            intent="neutral"
            appearance="soft"
            size="sm"
            onClick={onClose}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            intent="accent"
            appearance="solid"
            size="sm"
            isDisabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
