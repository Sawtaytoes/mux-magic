export const RULE_TYPES = ['setScriptInfo', 'scaleResolution', 'setStyleFields']

export const WHEN_CLAUSE_NAMES = [
  'anyScriptInfo',
  'allScriptInfo',
  'noneScriptInfo',
  'notAllScriptInfo',
  'anyStyle',
  'allStyle',
  'noneStyle',
]

export const APPLY_IF_CLAUSE_NAMES = [
  'anyStyleMatches',
  'allStyleMatches',
  'noneStyleMatches',
]

export const COMPARATOR_VERBS = ['eq', 'lt', 'gt', 'lte', 'gte']

export const COMPUTE_FROM_OPS_WITH_OPERAND = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'min',
  'max',
]

export const COMPUTE_FROM_OPS_BARE = ['round', 'floor', 'ceil', 'abs']

export const COMPUTE_FROM_OPS_ALL = [
  ...COMPUTE_FROM_OPS_WITH_OPERAND,
  ...COMPUTE_FROM_OPS_BARE,
]

// Default rules displayed when `hasDefaultRules: true`. Hardcoded from
// the table in docs/dsl/subtitle-rules.md §What "default rules" means.
// Update this list whenever buildDefaultSubtitleModificationRules.ts changes shape.
export const DEFAULT_RULES_PREVIEW = [
  {
    type: 'setScriptInfo',
    key: 'ScriptType',
    value: 'v4.00+',
  },
  {
    type: 'setScriptInfo',
    key: 'YCbCr Matrix',
    value: 'TV.709',
    when: {
      anyScriptInfo: {
        matches: { 'YCbCr Matrix': 'TV.601' },
        excludes: {
          'YCbCr Matrix': 'TV.601',
          PlayResX: '640',
          PlayResY: '480',
        },
      },
    },
  },
  {
    type: 'setStyleFields',
    fields: {
      MarginV: {
        computeFrom: {
          property: 'PlayResY',
          scope: 'scriptInfo',
          ops: [
            { divide: 1080 },
            { multiply: 90 },
            'round',
          ],
        },
      },
    },
    ignoredStyleNamesRegexString: 'signs?|op|ed|opening|ending',
  },
  {
    type: 'setStyleFields',
    fields: {
      MarginL: {
        computeFrom: {
          property: 'PlayResX',
          scope: 'scriptInfo',
          ops: [
            { divide: 1920 },
            { multiply: 200 },
            'round',
          ],
        },
      },
      MarginR: {
        computeFrom: {
          property: 'PlayResX',
          scope: 'scriptInfo',
          ops: [
            { divide: 1920 },
            { multiply: 200 },
            'round',
          ],
        },
      },
    },
    ignoredStyleNamesRegexString: 'signs?|op|ed|opening|ending',
    applyIf: {
      anyStyleMatches: {
        MarginL: { lt: 50 },
      },
    },
  },
]
