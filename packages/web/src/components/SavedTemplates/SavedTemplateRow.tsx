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
        ? "border-blue-500 bg-slate-800/60"
        : "border-transparent hover:bg-slate-800/40"
    }`}
    data-template-id={template.id}
  >
    <button
      type="button"
      onClick={onLoad}
      title={template.description ?? template.name}
      className="block w-full text-left text-sm text-slate-200 truncate"
    >
      {template.name}
    </button>
    {template.description !== undefined &&
      template.description.length > 0 && (
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {template.description}
        </p>
      )}
    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
      <button
        type="button"
        onClick={onUpdateFromCurrent}
        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
        title="Overwrite this template with the current sequence"
      >
        Update
      </button>
      <button
        type="button"
        onClick={onRename}
        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={onEditDescription}
        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
      >
        Edit description
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-1.5 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-100"
      >
        Delete
      </button>
    </div>
  </li>
)
