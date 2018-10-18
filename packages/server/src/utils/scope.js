export function getScope(expr) {
  // See if this an eager scope, and if so, remove the trailing ~ for
  // internal handling.
  const eager = expr?.[0] === '~'
  const scope = eager ? expr.substring(1) : expr
  return { scope, eager }
}
