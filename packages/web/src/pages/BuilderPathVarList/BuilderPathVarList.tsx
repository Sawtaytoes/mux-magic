import { useAtomValue, useSetAtom } from "jotai"

import { PathVarCard } from "../../components/PathVarCard/PathVarCard"
import { pathsAtom } from "../../state/pathsAtom"
import { addPathAtom } from "../../state/sequenceAtoms"

export const BuilderPathVarList = () => {
  const paths = useAtomValue(pathsAtom)
  const addPath = useSetAtom(addPathAtom)

  return (
    <div className="flex flex-col gap-2 mb-4">
      {paths.map((pathVar, idx) => (
        <PathVarCard
          key={pathVar.id}
          pathVar={pathVar}
          isFirst={idx === 0}
        />
      ))}
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
