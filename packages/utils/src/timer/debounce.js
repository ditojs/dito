import { isNumber } from '../base/index.js'

export function debounce(func, options) {
  const { delay, immediate } = isNumber(options) ? { delay: options } : options

  let timer = null
  let result

  const debounced = function(...args) {
    const callNow = immediate && !timer
    clearTimeout(timer)
    timer = setTimeout(async () => {
      timer = null
      if (!immediate) {
        result = func.apply(this, args)
      }
    }, delay)
    if (callNow) {
      result = func.apply(this, args)
    }
    return result
  }

  debounced.cancel = function() {
    const pending = timer !== null
    if (pending) {
      clearTimeout(timer)
      timer = null
    }
    return pending
  }

  return debounced
}
