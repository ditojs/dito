const mixinsMap = new WeakMap()

export function mixin(mixin) {
  return function(Class) {
    if (Class) {
      // Prevent multiple application of the same mixins in nested inheritance
      // through keeping track of what was already applied in weak-maps:
      if (!hasMixin(Class, mixin)) {
        Class = mixin(Class)
        addMixin(Class, mixin)
      }
    }
    return Class
  }
}

function hasMixin(Class, mixin) {
  // We need to walk up the inheritance chain and check on every level.
  while (Class) {
    if (mixinsMap.get(Class)?.get(mixin)) {
      return true
    }
    Class = Object.getPrototypeOf(Class)
  }
  return false
}

function addMixin(Class, mixin) {
  let mixins = mixinsMap.get(Class)
  if (!mixins) {
    mixinsMap.set(Class, mixins = new WeakMap())
  }
  mixins.set(mixin, true)
}
