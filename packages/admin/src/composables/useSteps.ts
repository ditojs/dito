import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { isFunction } from '@ditojs/utils'

// Work that blocks the page for long runs in steps: the first one right away
// and the others over the next frames. Each step does as much as keeps it
// short, so that transitions keep running. Steps measure their work in the
// fields that they render: at about 35 µs per component and 10 to 16
// components per field, a frame of `frameDuration` renders about 100 fields:
const firstStep = 100
const frameDuration = 50

// Run the steps while the browser is idle between frames, which keeps the
// frames short, but after `frameDuration` at the latest, as browsers may not
// report idle time for long. Without idle callbacks, run in the next frame:
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

// Run `callback` with the number of fields to render in each step, until
// `stop()`:
export function useSteps(callback: (fields: number) => void) {
  const request = shallowRef(0)
  let step = firstStep
  let lastTime = 0

  const runStep = (time: number) => {
    // Adjust the step to the time that the last one took:
    const duration = lastTime ? time - lastTime : frameDuration
    step = Math.max(1, Math.round(step * (frameDuration / duration)))
    lastTime = time
    // Request the next step first, as `callback` may stop the steps:
    request.value = requestStep(runStep)
    callback(step)
  }

  const stop = () => {
    cancelStep(request.value)
    request.value = 0
  }

  onBeforeUnmount(stop)

  return {
    isRunning: computed(() => request.value !== 0),

    start() {
      if (!request.value) {
        step = firstStep
        lastTime = 0
        request.value = requestStep(runStep)
        callback(step)
      }
    },

    stop
  }
}

// Count the items from `start` on that render within `fields`, at least one:
export function countStepItems<T>(
  items: T[],
  start: number,
  fields: number,
  getItemWeight: (item: T, index: number) => number
): number {
  let end = start
  let weight = 0
  while (end < items.length) {
    weight += getItemWeight(items[end], end)
    if (weight > fields && end > start) {
      break
    }
    end++
  }
  return end - start
}
