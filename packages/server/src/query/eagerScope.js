import { RelationExpression } from 'objection'

export default function eagerScope(modelClass, expr, scopes, prepend = false,
  isChild = false) {
  expr = RelationExpression.create(expr)
  // Only add the scope if it's not already defined by the eager statement and
  // if it's actually available as a filter in the model's namedFilters list.
  if (isChild) {
    for (const scope of scopes) {
      if (!expr.args.includes(scope) && modelClass.namedFilters[scope]) {
        expr.args[prepend ? 'unshift' : 'push'](scope)
      }
    }
  }
  if (expr.numChildren > 0) {
    const relations = modelClass.getRelations()
    for (const child of Object.values(expr.children)) {
      const relation = relations[child.name]
      eagerScope(relation.relatedModelClass, child, scopes, prepend, true)
    }
  }
  return expr
}
