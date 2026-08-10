import { Button } from "@charcuterie/ui"

import type { TemplateListItem } from "../../state/templatesApi"

type SavedTemplateRowProps = {
  template: TemplateListItem
  isSelected: boolean
  onLoad: () => void
  onUpdateFromCurrent: () => void
  onRename: () => void
  onEditDescription: () => void
  onDelete: () => void
}

// Single row in the SavedTemplates sidebar list. Pure presentational —
// owns no atoms — all mutation paths get handed back up to the panel,
// which owns the fetch / atom-set side effects. This keeps the row
// trivially testable: render with mock handlers and assert each is
// called when the right button fires.
//
// Layout: name button (click to load) on its own line, with the
// management buttons stacked under it. Compact enough to fit four
// rows in the narrow 18rem sidebar without crowding.
export const SavedTemplateRow = ({
  template,
  isSelected,
  onLoad,
  onUpdateFromCurrent,
  onRename,
  onEditDescription,
  onDelete,
}: SavedTemplateRowProps) => (
  <li
    className={`group rounded px-2 py-2 border ${
      isSelected
        ? "border-border-focus bg-surface-raised/60"
        : "border-transparent hover:bg-surface-raised/40"
    }`}
    data-template-id={template.id}
  >
    <button
      type="button"
      onClick={onLoad}
      title={template.description ?? template.name}
      className="block w-full text-left text-sm text-content-primary truncate"
    >
      {template.name}
    </button>
    {template.description !== undefined &&
      template.description.length > 0 && (
        <p className="text-xs text-content-secondary truncate mt-0.5">
          {template.description}
        </p>
      )}
    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
      <Button
        intent="neutral"
        appearance="soft"
        size="sm"
        onClick={onUpdateFromCurrent}
        title="Overwrite this template with the current sequence"
      >
        Update
      </Button>
      <Button
        intent="neutral"
        appearance="soft"
        size="sm"
        onClick={onRename}
      >
        Rename
      </Button>
      <Button
        intent="neutral"
        appearance="soft"
        size="sm"
        onClick={onEditDescription}
      >
        Edit description
      </Button>
      <Button
        intent="danger"
        appearance="soft"
        size="sm"
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  </li>
)
