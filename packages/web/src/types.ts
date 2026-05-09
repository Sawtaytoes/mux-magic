export type CommandField = {
  name: string
  type: string
  companionNameField?: string
}

export type CommandDefinition = {
  fields: CommandField[]
  persistedKeys?: string[]
}

export type Commands = Record<string, CommandDefinition>

export type StepLink =
  | string // path variable ID, e.g. "basePath"
  | { linkedTo: string; output: string } // step output reference

export type Step = {
  id: string
  alias: string
  command: string
  params: Record<string, unknown>
  links: Record<string, StepLink>
  status: string | null
  error: string | null
  isCollapsed: boolean
}

export type PathVar = {
  id: string
  label: string
  value: string
}

export type Group = {
  kind: "group"
  id: string
  label: string
  isParallel: boolean
  isCollapsed: boolean
  steps: Step[]
}

export type SequenceItem = Step | Group
