import { Button } from "@charcuterie/ui"

interface InsertDividerProps {
  index: number
  onInsertStep: () => void
  onInsertSequentialGroup: () => void
  onInsertParallelGroup: () => void
  onPaste: (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void
}

export const InsertDivider = ({
  index: _index,
  onInsertStep,
  onInsertSequentialGroup,
  onInsertParallelGroup,
  onPaste,
}: InsertDividerProps) => (
  <div className="col-span-full flex items-center group -my-0.5">
    <div className="flex-1 h-px bg-border-default/50 group-hover:bg-border-strong transition-colors" />
    <div className="flex items-center gap-1 mx-1">
      <Button
        intent="neutral"
        appearance="ghost"
        size="sm"
        onClick={onInsertStep}
        title="Insert a step here"
        className="whitespace-nowrap"
      >
        ➕ Step
      </Button>
      <Button
        intent="neutral"
        appearance="ghost"
        size="sm"
        onClick={onInsertSequentialGroup}
        title="Insert a sequential group here"
        className="whitespace-nowrap"
      >
        ➕ Group
      </Button>
      <Button
        intent="neutral"
        appearance="ghost"
        size="sm"
        onClick={onInsertParallelGroup}
        title="Insert a parallel group here"
        className="whitespace-nowrap"
      >
        ➕ Parallel
      </Button>
      <Button
        intent="neutral"
        appearance="ghost"
        size="sm"
        onClick={onPaste}
        title="Paste a copied step or group here"
        className="whitespace-nowrap"
      >
        📋 Paste
      </Button>
    </div>
    <div className="flex-1 h-px bg-border-default/50 group-hover:bg-border-strong transition-colors" />
  </div>
)
