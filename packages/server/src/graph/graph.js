import { isArray, asArray, clone, merge } from '@ditojs/utils'
import { RelationExpression } from 'objection'
import { collectExpressionPaths } from './expression.js'

// Similar to Objection's private `rootModelClass.ensureModelArray(data)`:
export function ensureModelArray(rootModelClass, data) {
  return data
    ? asArray(data).map(
      model => !model
        ? null
        : model instanceof rootModelClass
          ? model
          : rootModelClass.fromJson(model, { skipValidation: true })
    )
    : []
}

export function filterGraph(rootModelClass, graph, expr) {
  expr = RelationExpression.create(expr)
  const modelArray = ensureModelArray(rootModelClass, graph).map(model => {
    if (model) {
      const copy = new model.constructor()
      const relations = model.constructor.getRelations()
      // Loop through original data and check against relations,
      // to prevent key sequence in created clone:
      for (const key in model) {
        if (model.hasOwnProperty(key)) {
          const relation = relations[key]
          if (relation) {
            const child = expr[key]
            if (child) {
              copy[key] = filterGraph(
                relation.relatedModelClass,
                model[key],
                child
              )
            }
          } else {
            copy[key] = clone(model[key])
          }
        }
      }
      return copy
    }
    return model
  })
  return isArray(graph) ? modelArray : modelArray[0]
}

export async function populateGraph(rootModelClass, graph, expr, trx) {
  // TODO: Optimize the scenario where an item that isn't a leaf is a
  // reference and has multiple sub-paths to be populated. We may need to
  // move away from graph path handling and directly process the expression
  // tree, composing paths to the current place on the fly, and process data
  // with addToGroup(). Then use the sub-tree as eager expression when
  // encountering references (needs toString() for caching also?)
  // TODO: Better idea: First cache groups by the path up to their location in
  // the graph, and collect modify + eager statements there for references
  // that are not leaves. Then use the resulting nodes to create new groups by
  // model name / modify / eager.
  expr = RelationExpression.create(expr)
  // Convert RelationExpression to an array of paths, that themselves contain
  // path entries with relation names and modify settings.

  const grouped = {}
  const addToGroup = (item, modelClass, modify, eager) => {
    const id = item.$id()
    if (id != null) {
      // Group models by model-name + modify + eager, for faster loading:
      const key = `${modelClass.name}_${modify}_${eager || ''}`
      const group = grouped[key] || (grouped[key] = {
        modelClass,
        modify,
        eager,
        references: [],
        ids: [],
        modelsById: {}
      })
      group.references.push(item)
      // Collect ids to be loaded for the references.
      group.ids.push(id)
    }
  }

  const pathToEager = (path, start = 0) => {
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

  // Clone the full graph so we can directly modify it after:
  const modelArray = ensureModelArray(rootModelClass, graph).map(
    model => model?.$clone() || null
  )

  for (const path of collectExpressionPaths(expr)) {
    let modelClass = rootModelClass
    const modelClasses = []
    let modify
    for (const entry of path) {
      modelClasses.push(modelClass)
      modelClass = modelClass.getRelation(entry.relation).relatedModelClass
      modify = entry.modify
    }
    for (const model of modelArray) {
      if (model) {
        let items = asArray(model)
        // Collect all graph items described by the current relation path in
        // one loop:
        for (let i = 0, l = path.length; i < l; i++) {
          const part = path[i]
          if (items.length === 0) break
          const modelClass = modelClasses[i]
          items = items.reduce((items, item) => {
            let add = false
            if (modelClass.isReference(item)) {
              // Detected a reference item that isn't a leaf: We need to
              // eager-load the rest of the path, and respect modify settings.
              add = true
            } else {
              const value = item[part.relation]
              // Add the values of this relation to items, so they can be
              // filtered further in the next iteration of this loop.
              if (value != null) {
                items.push(...asArray(value))
              } else if (item.$id()) {
                // If the full relation is missing, but the current item has
                // a database id, simply eager-load the relation.
                add = true
              }
            }
            if (add) {
              addToGroup(item, modelClass, part.modify, pathToEager(path, i))
            }
            return items
          }, [])
        }
        // Add all encountered leaf-references to groups to be loaded.
        for (const item of items) {
          // Filter out items that aren't references, but always load when there
          // are modify statements, as we can't be sure if it's already there.
          if (modify.length > 0 || modelClass.isReference(item)) {
            addToGroup(item, modelClass, modify)
          }
        }
      }
    }
  }

  const groups = Object.values(grouped).filter(({ ids }) => ids.length > 0)
  if (groups.length > 0) {
    // Load all found models by ids asynchronously, within provided transaction.
    // NOTE: Using the same for the transaction means that all involved tables
    // need to be in the same DB.
    await Promise.map(
      groups,
      async ({ modelClass, modify, eager, ids, modelsById }) => {
        const query = modelClass.query(trx)
        if (modelClass.hasCompositeId()) {
          query.whereInComposite('id', ids)
        } else {
          query.whereIn('id', ids)
        }
        if (eager) {
          query.mergeEager(eager)
        }
        for (const mod of modify) {
          query.modify(mod)
        }
        const models = await query.execute()
        // Fill the group.modelsById lookup:
        for (const model of models) {
          modelsById[model.$id()] = model
        }
      }
    )

    // Finally populate the references with the loaded models.
    for (const { references, modelsById } of groups) {
      for (const item of references) {
        merge(item, modelsById[item.$id()])
      }
    }
  }

  return isArray(graph) ? modelArray : modelArray[0]
}
