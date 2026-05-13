import { useState } from "react"

export const CopyTextButton = ({
  getText,
}: {
  getText: () => string
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    navigator.clipboard
      .writeText(getText())
      .then(() => {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="ml-2 text-xs text-slate-500 hover:text-slate-300 shrink-0"
    >
      {isCopied ? "✓ Copied" : "📋 Copy"}
    </button>
  )
}
