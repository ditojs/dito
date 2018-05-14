export function scope(...scopes) {
  return (target, key, descriptor) => {
    const { value } = descriptor
    const scope = value.scope = value.scope || []
    scope.push(...scopes)
  }
}
