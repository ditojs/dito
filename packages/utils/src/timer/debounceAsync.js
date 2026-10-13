import { isNumber } from '../base/index.js'

export function debounceAsync(func, options) {
  const { delay, immediate } = isNumber(options) ? { delay: options } : options

  let timer = null
  let callbacks = []
  let result

  const resolve = result => {
    for (const { resolve } of callbacks) {
      resolve(result)
    }
    callbacks = []
  }

  const execute = async (that, args) => {
    try {
      result = await func.apply(that, args)
      resolve(result)
    } catch (err) {
      // Convention: reject the last waiting promise, while all the others are
      // resolved with undefined.
      const { reject } = callbacks.pop()
      result = undefined
      resolve(undefined)
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
      if (immediate && !callNow && callbacks.length === 0) {
        // The leading call already settled, so share its result:
        resolve(result)
      } else {
        callbacks.push({ resolve, reject })
        if (callNow) {
          execute(this, args)
        }
      }
    })
  }

  debounced.cancel = function () {
    const pending = timer !== null
    if (pending) {
      resolve(undefined)
      clearTimeout(timer)
      timer = null
    }
    return pending
  }

  return debounced
}
