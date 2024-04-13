export function extendContext() {
  return (ctx, next) => {
    ctx.extend = function (object) {
      // Create a copy of this context that inherits from the real one, but
      // overrides some properties with the ones from the passed `object`.
      return Object.setPrototypeOf(object, this)
    }
    return next()
  }
}
