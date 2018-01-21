export default function eagerScope(modelClass, exp, scope, add = 'push',
  isChild = false) {
  // Only add the scope if it's not already defined by the eager statement and
  // if it's actually available as a filter in the model's namedFilters list.
  if (isChild && !exp.args.includes(scope) && modelClass.namedFilters[scope]) {
    exp.args[add](scope)
  }
  if (exp.numChildren > 0) {
    const relations = modelClass.getRelations()
    for (const child of Object.values(exp.children)) {
      const relation = relations[child.name]
      eagerScope(relation.relatedModelClass, child, scope, add, true)
    }
  }
  return exp
}
