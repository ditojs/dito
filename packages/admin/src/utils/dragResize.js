// Resizes the height of `element` through a resize handle, either by dragging
// it with the pointer or with the arrow keys while it is focused. `onResize()`
// receives each new height in pixels.

// Starts dragging the resize handle from its `pointerdown` event. The pointer
// is captured by the handle, so that the drag continues outside of it, and the
// handlers are removed again when the drag ends.
export function startDragResize(event, { element, onResize }) {
  if (event.button !== 0) return
  const handle = event.currentTarget
  const { pointerId, clientY: startY } = event
  const startHeight = getHeight(element)
  const controller = new AbortController()
  const { signal } = controller

  const resize = event => {
    if (event.pointerId === pointerId) {
      onResize(Math.max(startHeight + event.clientY - startY, 0))
    }
  }

  const stop = event => {
    if (event.pointerId === pointerId) {
      controller.abort()
    }
  }

  handle.setPointerCapture(pointerId)
  handle.addEventListener('pointermove', resize, { signal })
  handle.addEventListener(
    'pointerup',
    event => {
      resize(event)
      stop(event)
    },
    { signal }
  )
  handle.addEventListener('pointercancel', stop, { signal })
  handle.addEventListener('lostpointercapture', stop, { signal })
}

const resizeDirectionsByKey = {
  ArrowUp: -1,
  ArrowDown: 1
}

// Resizes by one step of the element's font size per `ArrowUp` / `ArrowDown`
// `keydown` event on the focused resize handle, or by ten steps with Shift.
export function resizeByArrowKey(event, { element, onResize }) {
  const direction = resizeDirectionsByKey[event.key]
  if (direction) {
    event.preventDefault()
    const fontSize = parseFloat(getComputedStyle(element).fontSize)
    const step = event.shiftKey ? 10 * fontSize : fontSize
    onResize(Math.max(getHeight(element) + direction * step, 0))
  }
}

function getHeight(element) {
  return parseFloat(getComputedStyle(element).height)
}
