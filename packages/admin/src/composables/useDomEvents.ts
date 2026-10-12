import { onUnmounted } from 'vue'
import { isObject } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui/src'

type Handler = (event: any) => void

// Remove the handlers that are still added when the component is unmounted:
export function useDomEvents() {
  const controller = new AbortController()
  onUnmounted(() => controller.abort())
  return {
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
