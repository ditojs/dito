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
