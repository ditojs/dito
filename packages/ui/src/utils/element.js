// The closest ancestor of `element` that scrolls vertically, or `null`:
export function getScrollContainer(element) {
  let parent = element.parentElement
  while (parent && !/auto|scroll/.test(getComputedStyle(parent).overflowY)) {
    parent = parent.parentElement
  }
  return parent
}

// Like ARIA, treat all values of `aria-invalid` but `false` and empty ones as
// errors:
export function hasErrors(attributes) {
  return ![null, false, 'false', ''].includes(
    attributes['aria-invalid'] ?? null
  )
}
