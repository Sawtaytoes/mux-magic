import type {
  NsfEditionPlanMove,
  NsfEditionPlanRecord,
} from "../NsfRunResults/findNsfResults"

// Preview component for the edition-folder organization plan emitted by
// the NSF pipeline before any moves happen. Renders the planned moves
// grouped by edition, showing main features and their sibling files
// (trailers, behind-the-scenes, etc.) that will be co-moved.
type Props = {
  editionPlan: NsfEditionPlanRecord
}

// Extract unique edition names from the moves list, preserving order of
// first appearance.
const getUniqueEditionNames = (
  moves: NsfEditionPlanMove[],
): string[] => {
  const seen = new Set<string>()
  return moves
    .map((move) => move.editionName)
    .filter((editionName) => {
      if (seen.has(editionName)) {
        return false
      }
      seen.add(editionName)
      return true
    })
}

export const EditionPlanPreview = ({
  editionPlan,
}: Props) => {
  if (editionPlan.moves.length === 0) {
    return null
  }

  const editionNames = getUniqueEditionNames(
    editionPlan.moves,
  )

  return (
    <div
      data-edition-plan-preview
      className="flex flex-col gap-2"
    >
      <p className="text-xs text-slate-400 font-medium">
        Edition folders planned ({editionPlan.moves.length}{" "}
        {editionPlan.moves.length === 1 ? "file" : "files"}
        ):
      </p>
      {editionNames.map((editionName) => (
        <div
          key={editionName}
          data-edition-group
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs"
        >
          <p
            data-edition-name
            className="text-blue-300 font-medium mb-1"
          >
            {editionName}
          </p>
          <div className="font-mono flex flex-col gap-0.5">
            {editionPlan.moves
              .filter(
                (move) => move.editionName === editionName,
              )
              .map((move) => (
                <div
                  key={move.sourceFilename}
                  data-edition-plan-move
                  className="flex items-baseline gap-1.5 wrap-break-word"
                >
                  <span
                    className={
                      move.isSibling
                        ? "text-slate-400"
                        : "text-slate-200"
                    }
                  >
                    {move.sourceFilename}
                  </span>
                  {move.isSibling && (
                    <span
                      data-sibling-badge
                      className="text-slate-500 text-xs"
                    >
                      (sibling)
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
