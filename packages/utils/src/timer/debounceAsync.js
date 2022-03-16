import { isNumber } from '../base/index.js'

export function debounceAsync(func, options) {
  const { delay, immediate } = isNumber(options) ? { delay: options } : options

  let timer = null
  let callbacks = []
  let cancelled = false

  const resolve = result => {
    for (const { resolve } of callbacks) {
      resolve(result)
    }
  }

  const execute = async (that, args) => {
    try {
      resolve(await func.apply(that, args))
    } catch (err) {
      // Convention: reject the last waiting promise, while all the others are
      // resolved with undefined.
      const { reject } = callbacks.pop()
      resolve(undefined)
      reject(err)
    }
    callbacks = []
  }

  const debounced = function(...args) {
    return new Promise((resolve, reject) => {
      const callNow = immediate && !timer
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        if (!immediate) {
          execute(this, args)
        }
      }, delay)
      callbacks.push({ resolve, reject })
      if (cancelled) {
        resolve(undefined)
      } else if (callNow) {
        execute(this, args)
      }
    })
  }

  debounced.cancel = function() {
    const pending = timer !== null
    if (pending) {
      resolve(undefined)
      clearTimeout(timer)
      timer = null
    }
    cancelled = true
    return pending
  }

  return debounced
}
