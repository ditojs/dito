import { onUnmounted } from 'vue'
import { isObject } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui/src'

type Handler = (event: any) => void

// Add DOM event handlers that are removed when the component is unmounted, if
// they're still added then.
export function useDomEvents() {
  const controller = new AbortController()
  onUnmounted(() => controller.abort())
  return {
    // Add the event handlers to `element`, and return an object with a
    // `remove()` method that removes them again:
    domOn(
      element: EventTarget | EventTarget[],
      type: string | Record<string, Handler>,
      handler?: Handler
    ): { remove(): void } {
      const events = isObject(type) ? type : { [type]: handler }
      return addEvents(element, events, { signal: controller.signal })
    }
  }
}
