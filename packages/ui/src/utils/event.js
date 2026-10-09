import { asArray } from '@ditojs/utils'

// Adds the `events` handlers to all `targets`, and returns an object with a
// `remove()` method that removes them again. When a `signal` is passed, the
// handlers are also removed when it aborts, and not added at all when it
// already has.
export function addEvents(targets, events, { signal } = {}) {
  targets =
    targets instanceof NodeList
      ? Array.from(targets)
      : asArray(targets)

  const controller = new AbortController()
  if (!signal?.aborted) {
    // Remove the handlers along with `signal`, through a listener that is
    // itself removed when the handlers are removed first:
    signal?.addEventListener('abort', () => controller.abort(), {
      once: true,
      signal: controller.signal
    })
    for (const [type, handler] of Object.entries(events)) {
      for (const target of targets) {
        target.addEventListener(type, handler, { signal: controller.signal })
      }
    }
  }

  return {
    remove() {
      controller.abort()
    }
  }
}

export function combineEvents(...events) {
  return {
    remove() {
      for (const event of events) {
        event.remove()
      }
    }
  }
}

export function getKey(event) {
  return {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    13: 'enter'
  }[event?.keyCode]
}

export function getKeyNavigation(event) {
  const key = getKey(event)
  return {
    hor: { left: -1, right: 1 }[key] || 0,
    ver: { up: -1, down: 1 }[key] || 0,
    enter: key === 'enter'
  }
}
