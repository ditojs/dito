import { isObject, asArray } from '@ditojs/utils'

export function collectExpressionPaths(expr) {
  const paths = []
  for (const key of Object.keys(expr)) {
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
  return paths
}

export function expressionPathToString(path, start = 0) {
  return (start ? path.slice(start) : path)
    .map(({ relation, alias, modify }) => {
      const expr = alias ? `${relation} as ${alias}` : relation
      return modify.length > 0
        ? `${expr}(${modify.join(', ')})`
        : expr
    })
    .join('.')
}

export function modelGraphToExpression(modelGraph, expr) {
  if (modelGraph) {
    expr ||= {}
    for (const model of asArray(modelGraph)) {
      if (model) {
        const relations = model.constructor.getRelations()
        for (const { name } of Object.values(relations)) {
          if (model.hasOwnProperty(name)) {
            expr[name] = modelGraphToExpression(model[name], expr[name])
          }
        }
      }
    }
  }
  return expr
}
