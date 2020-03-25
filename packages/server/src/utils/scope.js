export function getScope(expr) {
  // See if this an graph scope, and if so, remove the trailing ^ for
  // internal handling.
  const graph = expr?.[0] === '^'
  const scope = graph ? expr.substring(1) : expr
  return { scope, graph }
}
