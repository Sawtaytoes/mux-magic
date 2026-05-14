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
}

export const TagInputBase = ({
  tags,
  onRemove,
  inputProps,
  inputRef,
  children,
}: TagInputBaseProps) => (
  <div className="flex flex-col gap-1">
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag.key}
            className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5"
          >
            {tag.label}
            <button
              type="button"
              onClick={() => onRemove(tag.key)}
              className="text-slate-400 hover:text-red-400 leading-none cursor-pointer"
              title={tag.title}
              aria-label={tag.title}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    )}
    <div className="relative">
      <input
        ref={inputRef}
        {...inputProps}
        className="w-full bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500"
      />
      {children}
    </div>
  </div>
)
