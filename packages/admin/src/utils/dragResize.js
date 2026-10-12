// Capture the pointer, so the drag continues outside of the handle:
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

const resizeDirectionsByKey = { ArrowUp: -1, ArrowDown: 1 }

// Resize by one step of the element's font size, or by ten with Shift:
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
