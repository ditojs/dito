// Test helpers for components that use `DitoTrigger`.

// Whether the popup of the `DitoTrigger` in `wrapper` is shown. The popup is
// toggled with `v-show`, so it stays rendered while hidden.
export function isPopupShown(wrapper) {
  return wrapper.find('.dito-popup').element.style.display !== 'none'
}
