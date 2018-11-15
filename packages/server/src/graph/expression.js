import { isObject, asArray } from '@ditojs/utils'

export function collectExpressionPaths(expr) {
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
          // The child is a leaf.
          paths.push([entry])
        }
      }
    }
  }
  return paths
}

export function expressionPathToEager(path, start = 0) {
  return (start ? path.slice(start) : path)
    .map(
      ({ relation, alias, modify }) => {
        const expr = alias ? `${relation} as ${alias}` : relation
        return modify.length > 0
          ? `${expr}(${modify.join(', ')})`
          : expr
      }
    )
    .join('.')
}

export function modelGraphToExpression(graph, node) {
  if (graph) {
    node = node || {}
    for (const model of asArray(graph)) {
      for (const { name } of Object.values(model.constructor.getRelations())) {
        if (model.hasOwnProperty(name)) {
          node[name] = modelGraphToExpression(model[name], node[name])
        }
      }
    }
  }
  return node
}
