import { isObject, isArray, asArray } from '@ditojs/utils'
import { QueryBuilder } from '../query/index.js'
import { collectExpressionPaths, expressionPathToString } from './expression.js'

// Similar to Objection's private `modelClass.ensureModel(model)`:
export function ensureModel(modelClass, model, options) {
  return !model
    ? null
    : model instanceof modelClass
      ? parseRelationsIntoModelInstances(model, model, options)
      : modelClass.fromJson(model, options)
}

// Similar to Objection's private `modelClass.ensureModelArray(data)`:
export function ensureModelArray(modelClass, data, options) {
  return data
    ? asArray(data).map(model => ensureModel(modelClass, model, options))
    : []
}

function parseRelationsIntoModelInstances(model, json, options = {}) {
  if (!options.cache) {
    options = { ...options, cache: new Map() }
  }
  options.cache.set(json, model)

  for (const relationName of model.constructor.getRelationNames()) {
    const jsonRelation = json[relationName]
    if (jsonRelation !== undefined) {
      const relation = model.constructor.getRelation(relationName)
      const parsedRelation = parseRelation(jsonRelation, relation, options)
      if (parsedRelation !== jsonRelation) {
        model[relation.name] = parsedRelation
      }
    }
  }

  return model
}

function parseRelation(json, relation, options) {
  return isArray(json)
    ? parseRelationArray(json, relation, options)
    : parseRelationObject(json, relation, options)
}

function parseRelationArray(json, relation, options) {
  const models = new Array(json.length)
  let changed = false
  for (let i = 0, l = json.length; i < l; i++) {
    const model = parseRelationObject(json[i], relation, options)
    changed = changed || (model !== json[i])
    models[i] = model
  }
  return changed ? models : json
}

function parseRelationObject(json, relation, options) {
  if (isObject(json)) {
    const modelClass = relation.relatedModelClass
    let model = options.cache.get(json)
    if (model === undefined) {
      if (json instanceof modelClass) {
        model = parseRelationsIntoModelInstances(json, json, options)
      } else {
        model = modelClass.fromJson(json, options)
      }
    }
    return model
  }
  return json
}

export function walkGraph(data, callback, path = []) {
  if (isObject(data) || isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      const dataPath = [...path, key]
      callback(value, dataPath, data, key)
      walkGraph(value, callback, dataPath)
    }
  }
}

export function filterGraph(rootModelClass, modelGraph, expr) {
  expr = QueryBuilder.parseRelationExpression(expr)
  const models = ensureModelArray(rootModelClass, modelGraph, {
    skipValidation: true
  })
  for (const model of models) {
    if (model) {
      const relations = model.constructor.getRelations()
      for (const key of Object.keys(model)) {
        const relation = relations[key]
        if (relation) {
          const child = expr[key]
          if (child) {
            // Allowed relation, keep filtering recursively:
            filterGraph(
              relation.relatedModelClass,
              model[key],
              child
            )
          } else {
            // Disallowed relation, delete:
            delete model[key]
          }
        }
      }
    }
  }
  return modelGraph
}

export async function populateGraph(rootModelClass, graph, expr, trx) {
  // TODO: Optimize the scenario where an item that isn't a leaf is a
  // reference and has multiple sub-paths to be populated. We may need to
  // move away from graph path handling and directly process the expression
  // tree, composing paths to the current place on the fly, and process data
  // with addToGroup(). Then use the sub-tree as graph expression when
  // encountering references (needs toString() for caching also?)
  // TODO: Better idea: First cache groups by the path up to their location in
  // the graph, and collect modify + graph expressions there for references
  // that are not leaves. Then use the resulting nodes to create new groups by
  // model name / modify / graph expressions.
  expr = QueryBuilder.parseRelationExpression(expr)
  // Convert the relation expression to an array of paths, that themselves
  // contain path entries with relation names and modify settings.

  const grouped = {}
  const addToGroup =
    (item, modelClass, isReference, modify, relation, expr) => {
      const id = item.$id()
      if (id != null) {
        // Group models by model-name + modify + expr, for faster loading:
        const key = `${modelClass.name}_${modify}_${expr || ''}`
        const group = grouped[key] || (grouped[key] = {
          modelClass,
          modify,
          relation,
          expr,
          targets: [],
          ids: [],
          modelsById: {}
        })
        group.targets.push({ item, isReference })
        // Collect ids to be loaded for the targets.
        group.ids.push(id)
      }
    }

  for (const path of collectExpressionPaths(expr)) {
    let modelClass = rootModelClass
    const modelClasses = []
    let lastModify
    for (const entry of path) {
      modelClasses.push(modelClass)
      modelClass = modelClass.getRelation(entry.relation).relatedModelClass
      lastModify = entry.modify
    }
    for (const model of asArray(graph)) {
      if (model) {
        let items = asArray(model)
        // Collect all graph items described by the current relation path in
        // one loop:
        for (let i = 0, l = path.length; i < l; i++) {
          if (items.length === 0) break
          const { relation } = path[i]
          const modelClass = modelClasses[i]
          items = items.reduce((items, item) => {
            item = ensureModel(modelClass, item, { skipValidation: true })
            let add = false
            const isReference = modelClass.isReference(item)
            if (isReference) {
              // Detected a reference item that isn't a leaf: We need to
              // eager-load the rest of the path, and respect modify settings.
              add = true
            } else {
              const value = item[relation]
              // Add the models of this relation to items, so they can be
              // filtered further in the next iteration of this loop.
              if (value != null) {
                items.push(...asArray(value))
              } else if (value === undefined) {
                // If the full relation is missing try eager-loading it.
                // NOTE: Values of `null` are respected here, not loaded again.
                add = true
              }
            }
            if (add) {
              // `path[i].modify` is the current relation's modify expression,
              // get the parent one for `modelClass`:
              const modify = i > 0 ? path[i - 1].modify : null
              const expr = expressionPathToString(path, i)
              addToGroup(item, modelClass, isReference, modify, relation, expr)
            }
            return items
          }, [])
        }
        // Add all encountered leaf-references to groups to be loaded.
        for (const item of items) {
          // Only load leafs that are references.
          if (modelClass.isReference(item)) {
            addToGroup(item, modelClass, true, lastModify)
          }
        }
      }
    }
  }

  const groups = Object.values(grouped).filter(({ ids }) => ids.length > 0)
  if (groups.length > 0) {
    // Load all found models by ids asynchronously, within provided transaction.
    // NOTE: Using the same transaction means that all involved tables need to
    // be in the same database.
    await Promise.all(
      groups.map(async ({ modelClass, modify, expr, ids, modelsById }) => {
        const query = modelClass.query(trx).findByIds(ids).modify(modify)
        if (expr) {
          // TODO: Make algorithm configurable through options.
          query.withGraph(expr)
        }
        const models = await query
        // Fill the group.modelsById lookup:
        for (const model of models) {
          modelsById[model.$id()] = model
        }
      })
    )

    // Finally populate the targets with the loaded models.
    for (const { targets, modelsById, relation } of groups) {
      for (const { item, isReference } of targets) {
        const model = modelsById[item.$id()]
        if (model) {
          if (isReference) {
            // Copy over the full item.
            Object.assign(item, model)
          } else {
            // Just copy the eager-loaded relation.
            item[relation] = model[relation]
          }
        }
      }
    }
  }

  return graph
}
