import { asArray } from '@ditojs/utils'

// Adds the `events` handlers to all `targets`, and returns an object with a
// `remove()` method that removes them again. When a `signal` is passed, the
// handlers are also removed when it aborts, and not added at all when it
// already has. Other `options` are passed on to `addEventListener()`.
export function addEvents(targets, events, { signal, ...options } = {}) {
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
        target.addEventListener(type, handler, {
          ...options,
          signal: controller.signal
        })
      }
    }
  }

  return {
    remove() {
      controller.abort()
    }
  }
}
