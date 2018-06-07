export function toCallback(asyncFunction) {
  return async (...args) => {
    const done = args.pop()
    try {
      done(null, await asyncFunction(...args))
    } catch (err) {
      done(err)
    }
  }
}

export function toAsync(callbackFunction) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      callbackFunction(...args, (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  }
}
