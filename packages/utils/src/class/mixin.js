// `mixinsMap` is a weak-map that links classes to the mixin functions that
// produced them.
const mixinsMap = new WeakMap()

export function mixin(mixinFunction) {
  return function (targetClass) {
    // Prevent multiple application of the same mixins in nested inheritance
    // through keeping track of what was already applied in weak-maps:
    if (targetClass && !hasMixin(targetClass, mixinFunction)) {
      const mixinClass = mixinFunction(targetClass)
      mixinsMap.set(mixinClass, mixinFunction)
      return mixinClass
    }
    return targetClass
  }
}

function hasMixin(targetClass, mixinFunction) {
  // Walk up the inheritance chain and check on every level if this mixin was
  // already applied.
  let currentClass = targetClass
  while (currentClass) {
    if (mixinsMap.get(currentClass) === mixinFunction) {
      return true
    }
    currentClass = Object.getPrototypeOf(currentClass)
  }
  return false
}
