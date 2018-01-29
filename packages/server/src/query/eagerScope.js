export default function eagerScope(modelClass, exp, scopes, prepend = false,
  isChild = false) {
  // Only add the scope if it's not already defined by the eager statement and
  // if it's actually available as a filter in the model's namedFilters list.
  if (isChild) {
    for (const scope of scopes) {
      if (!exp.args.includes(scope) && modelClass.namedFilters[scope]) {
        exp.args[prepend ? 'unshift' : 'push'](scope)
      }
    }
  }
  if (exp.numChildren > 0) {
    const relations = modelClass.getRelations()
    for (const child of Object.values(exp.children)) {
      const relation = relations[child.name]
      eagerScope(relation.relatedModelClass, child, scopes, prepend, true)
    }
  }
  return exp
}
