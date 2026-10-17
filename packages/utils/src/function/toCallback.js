export function toCallback(asyncFunction) {
  return async (...args) => {
    // The last argument is the callback function
    const done = args.pop()
    let result
    try {
      result = await asyncFunction(...args)
    } catch (err) {
      return done(err)
    }
    done(null, result)
  }
}
