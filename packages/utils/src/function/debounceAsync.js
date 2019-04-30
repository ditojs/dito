export function debounceAsync(func, delay, immediate) {
  let timer
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
    return new Promise(async (resolve, reject) => {
      const callNow = immediate && !timer
      clearTimeout(timer)
      timer = setTimeout(async () => {
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
    clearTimeout(timer)
    timer = null
    cancelled = true
  }

  return debounced
}
