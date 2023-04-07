export function getAbsoluteBoundingRect(el) {
  const doc = document
  const win = window
  const body = doc.body
  // pageXOffset and pageYOffset work everywhere except IE <9.
  let offsetX =
    win.pageXOffset !== undefined
      ? win.pageXOffset
      : (doc.documentElement || body.parentNode || body).scrollLeft
  let offsetY =
    win.pageYOffset !== undefined
      ? win.pageYOffset
      : (doc.documentElement || body.parentNode || body).scrollTop
  const rect = el.getBoundingClientRect()
  if (el !== body) {
    let parent = el.parentNode
    // The element's rect will be affected by the scroll positions of
    // *all* of its scrollable parents, not just the window, so we have
    // to walk up the tree and collect every scroll offset. Good times.
    while (parent !== body) {
      offsetX += parent.scrollLeft
      offsetY += parent.scrollTop
      parent = parent.parentNode
    }
  }
  return {
    bottom: rect.bottom + offsetY,
    height: rect.height,
    left: rect.left + offsetX,
    right: rect.right + offsetX,
    top: rect.top + offsetY,
    width: rect.width
  }
}
