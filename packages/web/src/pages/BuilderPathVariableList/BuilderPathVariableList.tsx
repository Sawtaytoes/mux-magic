import { useAtomValue, useSetAtom } from "jotai"

import { PathVariableCard } from "../../components/PathVariableCard/PathVariableCard"
import { ThreadCountVariableCard } from "../../components/ThreadCountVariableCard/ThreadCountVariableCard"
import {
  addPathAtom,
  pathsAtom,
} from "../../state/pathsAtom"

export const BuilderPathVariableList = () => {
  const paths = useAtomValue(pathsAtom)
  const addPath = useSetAtom(addPathAtom)

  return (
    <div className="flex flex-col gap-2 mb-4">
      {paths.map((pathVariable, idx) => (
        <PathVariableCard
          key={pathVariable.id}
          pathVariable={pathVariable}
          isFirst={idx === 0}
        />
      ))}
      <ThreadCountVariableCard />
      <button
        type="button"
        onClick={() => addPath()}
        className="self-start text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-dashed border-slate-700 hover:border-slate-500 transition-colors"
      >
        + Add path variable
      </button>
    </div>
  )
}
