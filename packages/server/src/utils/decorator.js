export function createDecorator(handler) {
  return (target, key, descriptor) => {
    // Convert `descriptor.initializer()` to `descriptor.value`:
    if (descriptor.initializer) {
      descriptor.value = descriptor.initializer()
      delete descriptor.initializer
    }
    handler(descriptor.value)
  }
}
