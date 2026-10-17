import { isNumber } from '../base/index.js'

export function debounceAsync(func, options) {
  const { delay, immediate } = isNumber(options) ? { delay: options } : options

  let timer = null
  let callbacks = []
  let leadingRun

  const resolve = (entries, result) => {
    for (const { resolve } of entries) {
      resolve(result)
    }
  }

  const execute = async (that, args) => {
    // Only settle the promises waiting when the run starts, calls made during
    // the run wait for their own run:
    const waiting = callbacks
    callbacks = []
    try {
      const result = await func.apply(that, args)
      resolve(waiting, result)
      return result
    } catch (err) {
      // Convention: reject the last waiting promise, while all the others are
      // resolved with undefined.
      const { reject } = waiting.pop()
      resolve(waiting, undefined)
      reject(err)
    }
  }

  const debounced = function (...args) {
    return new Promise((resolve, reject) => {
      const callNow = immediate && !timer
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        if (!immediate) {
          execute(this, args)
        }
      }, delay)
      if (immediate && !callNow) {
        // Share the result of the leading call, once it settles:
        resolve(leadingRun)
      } else {
        callbacks.push({ resolve, reject })
        if (callNow) {
          leadingRun = execute(this, args)
        }
      }
    })
  }

  debounced.cancel = function () {
    const pending = timer !== null
    if (pending) {
      resolve(callbacks, undefined)
      callbacks = []
      clearTimeout(timer)
      timer = null
    }
    return pending
  }

  return debounced
}
