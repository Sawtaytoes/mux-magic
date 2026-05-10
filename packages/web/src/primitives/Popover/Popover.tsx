// Thin re-exports of @radix-ui/react-popover.
// Used by Wave D+ components (StepCard, GroupCard) where the trigger IS a
// React element and Radix can handle positioning automatically.
// Wave C pickers (CommandPicker, EnumPicker, etc.) use fixed positioning
// instead, because their triggers are legacy DOM elements during the
// transitional period.
export {
  Anchor as PopoverAnchor,
  Close as PopoverClose,
  Content as PopoverContent,
  Portal as PopoverPortal,
  Root as Popover,
  Trigger as PopoverTrigger,
} from "@radix-ui/react-popover"
