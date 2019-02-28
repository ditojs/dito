export function mixin(mixin) {
  return function(Class) {
    // Prevent multi-inheritance of the same mixins:
    if (Class && !Class.mixins?.includes(mixin)) {
      Class = mixin(Class)
      Class.mixins = Class.mixins || []
      Class.mixins.push(mixin)
    }
    return Class
  }
}
