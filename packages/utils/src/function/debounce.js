export function debounce(func, delay, immediate) {
  let timer
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
    clearTimeout(timer)
    timer = null
  }

  return debounced
}
