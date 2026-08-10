import { Button } from "@charcuterie/ui"
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
    <Button
      intent="neutral"
      appearance="ghost"
      size="sm"
      onClick={handleClick}
      className="ms-2 shrink-0"
    >
      {isCopied ? "✓ Copied" : "📋 Copy"}
    </Button>
  )
}
