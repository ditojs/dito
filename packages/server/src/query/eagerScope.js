import { RelationExpression } from 'objection'
import { RelationError } from '@/errors'

export default function eagerScope(modelClass, expr, scopes, filters = null,
  prepend = false, isRoot = true) {
  if (isRoot) {
    expr = RelationExpression.create(expr)
  } else {
    // Only add the scope if it's not already defined by the eager statement and
    // if it's actually available as a filter in the model's namedFilters list.
    for (const scope of scopes) {
      if (!expr.args.includes(scope) &&
          (modelClass.namedFilters[scope] || filters?.[scope])) {
        expr.args[prepend ? 'unshift' : 'push'](scope)
      }
    }
  }
  if (expr.numChildren > 0) {
    const relations = modelClass.getRelations()
    for (const child of Object.values(expr.children)) {
      const relation = relations[child.name]
      if (!relation) {
        throw new RelationError(
          `Invalid child expression: "${child.name}"`)
      }
      eagerScope(
        relation.relatedModelClass, child, scopes, filters, prepend, false
      )
    }
  }
  return expr
}
