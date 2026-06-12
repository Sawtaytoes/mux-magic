export type RuleValue = {
  _id: number
  pattern: string
  flags: string
  replacement: string
  sample: string
}

export type DisplayMode = "plain" | "slash"
