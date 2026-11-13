// Test helpers for components that use `DitoTrigger`.

// Whether the popup of the `DitoTrigger` in `wrapper` is shown. reka-ui renders
// the popup only while it is shown, and keeps closing popups for their
// animation.
export function isPopupShown(wrapper) {
  return wrapper.find('.dito-popup[data-state="open"]').exists()
}
