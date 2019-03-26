export function toCallback(asyncFunction) {
  return async (...args) => {
    // The last argument is the callback function
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
      callbackFunction(...args, toPromiseCallback(resolve, reject))
    })
  }
}

export function toPromiseCallback(resolve, reject) {
  return (err, res) => {
    if (err) {
      reject(err)
    } else {
      resolve(res)
    }
  }
}
