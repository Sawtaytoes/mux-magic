import { useState } from "react"

export const CopyTextButton = ({
  getText,
}: {
  getText: () => string
}) => {
  const [copied, setCopied] = useState(false)

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    navigator.clipboard
      .writeText(getText())
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="ml-2 text-xs text-slate-500 hover:text-slate-300 shrink-0"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  )
}
