import { IconButton } from "@charcuterie/ui"

type TagItem = {
  key: string
  label: React.ReactNode
  title: string
}

type TagInputBaseProps = {
  tags: TagItem[]
  onRemove: (key: string) => void
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
  inputRef?: React.Ref<HTMLInputElement>
  children?: React.ReactNode
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "children"
>

/**
 * The chip list plus the text input the four tag fields share.
 *
 * ### Why it spreads its leftover props onto the `<input>`
 *
 * `Field` and `Tooltip` are slot components: each `cloneElement`s its one
 * child with `id`, `aria-describedby`, `aria-invalid`, `required` and the
 * tooltip's reference handlers. When that child is a component with a
 * **closed prop list**, React hands them over and the component drops every
 * one of them silently — the field renders, the label points at nothing,
 * and any assertion about the control's own props passes because they never
 * arrived. Nothing errors and nothing warns.
 *
 * So whatever this component is handed and does not name goes onto the
 * `<input>`, which is the control those relationships are about.
 * `inputProps` is spread last and wins on collision, because a call site
 * naming a prop explicitly means it.
 */
export const TagInputBase = ({
  tags,
  onRemove,
  inputProps,
  inputRef,
  children,
  ...slotProps
}: TagInputBaseProps) => (
  <div className="flex flex-col gap-1">
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag.key}
            className="inline-flex items-center gap-1 bg-surface-sunken text-content-primary text-xs rounded px-1.5 py-0.5"
          >
            {tag.label}
            <IconButton
              label={tag.title}
              title={tag.title}
              intent="danger"
              appearance="ghost"
              size="sm"
              onClick={() => onRemove(tag.key)}
              className="leading-none"
            >
              ✕
            </IconButton>
          </span>
        ))}
      </div>
    )}
    <div className="relative">
      <input
        ref={inputRef}
        {...slotProps}
        {...inputProps}
        className="w-full bg-surface-sunken text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus"
      />
      {children}
    </div>
  </div>
)
