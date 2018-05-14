export function eagerScope(...scopes) {
  return (target, key, descriptor) => {
    const { value } = descriptor
    const eagerScope = value.eagerScope = value.eagerScope || []
    eagerScope.push(...scopes)
  }
}
