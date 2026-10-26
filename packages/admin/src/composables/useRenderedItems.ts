import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  watch,
  type InjectionKey,
  type Ref
} from 'vue'
import { isFunction } from '@ditojs/utils'

// Long lists render their first items right away and the others over the next
// frames, so that they show their content without waiting for all of it. Each
// step renders as many as keep it short, so that transitions keep running:
const firstCount = 5
const frameDuration = 50

// Lists inside the items of other lists render all their items at once, as the
// steps of the outer list already spread the rendering over frames:
const isNestedKey: InjectionKey<boolean> = Symbol('isNested')

// Render the steps while the browser is idle between frames, which keeps the
// frames short, but after `frameDuration` at the latest, as browsers may not
// report idle time for long. Without idle callbacks, render in the next frame:
function requestStep(callback: (time: number) => void): number {
  return isFunction(globalThis.requestIdleCallback)
    ? requestIdleCallback(() => callback(performance.now()), {
        timeout: frameDuration
      })
    : requestAnimationFrame(callback)
}

function cancelStep(step: number) {
  if (isFunction(globalThis.cancelIdleCallback)) {
    cancelIdleCallback(step)
  } else {
    cancelAnimationFrame(step)
  }
}

export function useRenderedItems<T>(items: Ref<T[]>) {
  const count = ref(inject(isNestedKey, false) ? Infinity : firstCount)
  provide(isNestedKey, true)
  let step = firstCount
  let request = 0
  let lastTime = 0

  // Once all items rendered, the ones added later render right away:
  const renderAll = () => {
    cancelStep(request)
    request = 0
    count.value = Infinity
  }

  const renderMore = (time: number) => {
    // Adjust the step to the time that the last one took to render:
    const duration = lastTime ? time - lastTime : frameDuration
    step = Math.max(1, Math.round(step * (frameDuration / duration)))
    lastTime = time
    count.value += step
    if (count.value < items.value.length) {
      request = requestStep(renderMore)
    } else {
      renderAll()
    }
  }

  watch(
    () => items.value.length,
    length => {
      if (length > count.value) {
        request ||= requestStep(renderMore)
      } else if (length > 0) {
        renderAll()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => cancelStep(request))

  return {
    renderedItems: computed(() =>
      items.value.length > count.value
        ? items.value.slice(0, count.value)
        : items.value
    ),

    renderItemsUpTo(index: number) {
      count.value = Math.max(count.value, index + 1)
    }
  }
}
