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

  if (!isOpen) return null

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
    <div
      role="dialog"
      aria-label="Save sequence as template"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70"
    >
      <form
        onSubmit={onSubmit}
        className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Save sequence as template
        </h2>

        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100"
            placeholder="My workflow"
          />
        </label>

        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Description (optional)
          </span>
          <textarea
            rows={3}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100"
            placeholder="What this template is for"
          />
        </label>

        {errorMessage !== null && (
          <p
            role="alert"
            className="text-red-400 text-sm mb-3 whitespace-pre-wrap"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm text-slate-300 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-slate-400 rounded text-white"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
