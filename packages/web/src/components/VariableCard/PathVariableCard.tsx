import type { Variable } from "../../types"
import { VariableCard } from "./VariableCard"

export const PathVariableCard = ({
  pathVariable,
  isFirst,
}: {
  pathVariable: Variable
  isFirst: boolean
}) => (
  <VariableCard variable={pathVariable} isFirst={isFirst} />
)
