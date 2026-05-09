import { esc } from './util/html-escape.js'
import { renderCollapseChevron } from './components/collapse-chevron.js'
import { renderCopyIcon } from './components/copy-icon.js'
import { renderDoubleChevron } from './components/double-chevron.js'
import { renderStatusBadge } from './components/status-badge.js'
import { renderGroupCard } from './components/group-card.js'
import { renderStepCard } from './components/step-card.js'
import { renderStepCompactCard } from './components/step-card-compact.js'

export { esc, renderCollapseChevron, renderCopyIcon, renderDoubleChevron, renderStatusBadge }
export { renderInsertDivider } from './components/insert-divider.js'
export { renderSequenceEndCard } from './components/sequence-end-card.js'
export { LOOKUP_LINKS } from './util/lookup-links.js'
export { renderGroupCard, renderStepCard, renderStepCompactCard }

/**
 * @typedef {{ id: string, command: string | null, params: Record<string, unknown>, links: Record<string, unknown>, status?: string, alias?: string, isCollapsed?: boolean, jobId?: string, error?: string }} Step
 * @typedef {{ id: string, isParallel?: boolean, isCollapsed?: boolean, label: string, steps: Step[] }} Group
 * @typedef {{ parentGroupId?: string }} StepContext
 */

export function isDrawerMode() {
  try { return localStorage.getItem('useDrawerStepCards') === 'true' } catch { return false }
}

// Backward-compat positional-arg wrappers (used by callers not yet migrated to props API)
export function renderStep(step, index, context = {}) {
  return renderStepCard({ step, index, context })
}

export function renderStepCompact(step, index, context = {}) {
  return renderStepCompactCard({ step, index, context })
}

export function renderGroup(group, itemIndex, startingFlatIndex) {
  return renderGroupCard({ group, itemIndex, startingFlatIndex, renderStep: (s, i, c) => renderStepCard({ step: s, index: i, context: c }) })
}
