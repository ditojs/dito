import { isArray, asArray, clone } from '@ditojs/utils'
import { RelationExpression } from 'objection'
import { collectExpressionPaths } from './expression.js'

// The same as Objection's private `rootModelClass.ensureModelArray(data)`:
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

export function filterGraph(graph, expr) {
  expr = RelationExpression.create(expr)
  const modelArray = asArray(graph).map(model => {
    if (model) {
      const copy = new model.constructor()
      const relations = model.constructor.getRelations()
      // Loop through original data and check against relations,
      // to prevent key sequence in created clone:
      for (const key in model) {
        if (model.hasOwnProperty(key)) {
          if (key in relations) {
            const child = expr[key]
            if (child) {
              copy[key] = filterGraph(model[key], child)
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

export async function populateGraph(rootModelClass, graph, expr) {
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
    // Group models by model-name + modify + eager, for faster loading:
    const key = `${modelClass.name}_${modify}_${eager || ''}`
    const group = grouped[key] || (grouped[key] = {
      modelClass,
      modify,
      eager,
      // TODO: Support composite keys where getIdProperty() returns an array.
      idProperty: modelClass.getIdProperty(),
      references: [],
      ids: [],
      modelsById: {}
    })
    // Filter out the items that aren't references,
    // and collect ids to be loaded for references.
    if (modify.length > 0 || modelClass.isIdReference(item)) {
      const id = item[group.idProperty]
      if (id != null) {
        group.references.push(item)
        group.ids.push(id)
      }
    }
  }

  // Clone the full graph so we can directly modify it after:
  const modelArray = asArray(graph).map(model => model?.$clone() || null)

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
          const entry = path[i]
          if (items.length === 0) break
          const modelClass = modelClasses[i]
          items = items.reduce((items, item) => {
            if (modelClass.isIdReference(item)) {
              // Detected a reference item that isn't a leaf: We need to
              // eager-load the rest of the path, and respect modify settings:
              const eager = path.slice(i).map(
                ({ relation, alias, modify }) => {
                  const expr = alias ? `${relation} as ${alias}` : relation
                  return modify.length > 0
                    ? `${expr}(${modify.join(', ')})`
                    : expr
                }
              )
              addToGroup(item, modelClass, entry.modify, eager.join('.'))
            } else {
              const value = item[entry.relation]
              if (value != null) {
                items.push(...asArray(value))
              }
            }
            return items
          }, [])
        }
        // Add all encountered leaf-references to groups to be loaded.
        for (const item of items) {
          addToGroup(item, modelClass, modify)
        }
      }
    }
  }

  const groups = Object.values(grouped).filter(({ ids }) => ids.length > 0)

  // Load all found models by ids asynchronously.
  await Promise.map(
    groups,
    async ({ modelClass, modify, eager, idProperty, ids, modelsById }) => {
      const query = modelClass.whereIn('id', ids)
      if (eager) {
        query.mergeEager(eager)
      }
      for (const mod of modify) {
        query.modify(mod)
      }
      const models = await query.execute()
      // Fill the group.modelsById lookup:
      for (const model of models) {
        modelsById[model[idProperty]] = model
      }
    }
  )

  // Finally populate the references with the loaded models.
  for (const { idProperty, references, modelsById } of groups) {
    for (const item of references) {
      const id = item[idProperty]
      const model = modelsById[id]
      if (model) {
        Object.assign(item, model)
      }
    }
  }

  return isArray(graph) ? modelArray : modelArray[0]
}
