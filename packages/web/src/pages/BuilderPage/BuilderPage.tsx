import { ApiRunModal } from "../../components/ApiRunModal/ApiRunModal"
import { CommandHelpModal } from "../../components/CommandHelpModal/CommandHelpModal"
import { CommandPicker } from "../../components/CommandPicker/CommandPicker"
import { EnumPicker } from "../../components/EnumPicker/EnumPicker"
import { FileExplorerModal } from "../../components/FileExplorerModal/FileExplorerModal"
import { LinkPicker } from "../../components/LinkPicker/LinkPicker"
import { LoadModal } from "../../components/LoadModal/LoadModal"
import { LookupModal } from "../../components/LookupModal/LookupModal"
import { PageHeader } from "../../components/PageHeader/PageHeader"
import { PathPicker } from "../../components/PathPicker/PathPicker"
import { PromptModal } from "../../components/PromptModal/PromptModal"
import { YamlModal } from "../../components/YamlModal/YamlModal"

import { useBuilderKeyboard } from "../../hooks/useBuilderKeyboard"
import { BuilderPathVarList } from "../BuilderPathVarList"
import { BuilderSequenceList } from "../BuilderSequenceList/BuilderSequenceList"

// ─── BuilderPage ──────────────────────────────────────────────────────────────

export const BuilderPage = () => {
  useBuilderKeyboard()

  return (
    <div
      className="flex flex-col bg-slate-900 text-slate-200"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <BuilderPathVarList />
          <BuilderSequenceList />
        </div>
      </main>

      {/* Modals */}
      <YamlModal />
      <LoadModal />
      <CommandHelpModal />
      <PromptModal />
      <ApiRunModal />
      <LookupModal />
      <FileExplorerModal />

      {/* Pickers — render via createPortal into document.body */}
      <CommandPicker />
      <EnumPicker />
      <LinkPicker />
      <PathPicker />
    </div>
  )
}
