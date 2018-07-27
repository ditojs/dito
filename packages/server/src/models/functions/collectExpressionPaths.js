import { isObject } from '@ditojs/utils'

export default function collectExpressionPaths(expr) {
  const paths = []
  for (const key in expr) {
    if (expr.hasOwnProperty(key)) {
      const child = expr[key]
      if (isObject(child)) {
        const relation = child.$relation || key
        const alias = relation !== key ? key : undefined
        const modify = child.$modify
        const entry = { relation, alias, modify }
        const subPaths = collectExpressionPaths(child)
        if (subPaths.length > 0) {
          // The child has itself children.
          for (const subPath of subPaths) {
            paths.push([entry, ...subPath])
          }
        } else {
          // The child is a leaf, add $modify
          paths.push([entry])
        }
      }
    }
  }
  return paths
}
