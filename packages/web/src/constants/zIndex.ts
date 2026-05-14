// Centralized z-index scale. Popover > modal so popovers invoked from
// inside a modal stay reachable. See
// docs/workers/_archive/zindex-radix-consolidation.md for the planned
// Radix migration that would obsolete this file.
export const Z_INDEX = {
  base: 0,
  sticky: 10,
  dropdown: 40,
  modalBackdrop: 50,
  modal: 51,
  popover: 60,
  tooltip: 70,
  toast: 80,
  drawerBackdrop: 200, // mirrors .step-drawer-backdrop in builderStyles.css
  drawer: 201, // mirrors .step-drawer in builderStyles.css
} as const
