import { RelationExpression } from 'objection'
import { isArray, asArray, pick, getDataPath } from '@ditojs/utils'

export default class GraphProcessor {
  constructor(rootModelClass, data, restoreRelations, options) {
    this.rootModelClass = rootModelClass
    // Performs the same as `this.data = rootModelClass.ensureModelArray(data)`:
    this.data = data
      ? asArray(data).map(model => !model ? null
        : model instanceof rootModelClass ? model
        : rootModelClass.fromJson(model, { skipValidation: true })
      )
      : []
    this.isArray = isArray(data)
    this.options = options
    this.overrides = {}
    this.numOptions = Object.keys(options).length
    this.numOverrides = 0
    this.collectOverrides()
    if (this.numOverrides > 0) {
      this.processOverrides()
    }
    this.removedRelations = restoreRelations && {}
  }

  getOptions() {
    return this.numOverrides > 0
      ? { ...this.options, ...this.overrides }
      : this.options
  }

  getData() {
    // On inserts with relates, use processRelate() to filter out the nested
    // relations of models that are used for relates, but keep the removed
    // relations to restore them again on the results,see restoreRelations()
    const data = this.removedRelations && this.options.relate
      ? this.processRelates(this.data)
      : this.data
    return this.isArray ? data : data[0]
  }

  /**
   * Loops through all nested relations and finds the ones that define local
   * overrides of the global options, then collects empty override arrays for
   * each setting, so processOverrides() can fill them if any overrides exist.
   */
  collectOverrides() {
    const processed = {}
    const processModelClass = modelClass => {
      const { name } = modelClass
      if (!processed[name]) {
        const { relations } = modelClass.definition
        const relationInstances = modelClass.getRelations()
        for (const [name, relation] of Object.entries(relations)) {
          const { graph } = relation
          if (graph) {
            // Loop through this.options and only look for overrides of them,
            // since the relation.graph options are shared for insert  / upsert
            // & co., but not all of them use all options (insert defines less).
            for (const key in this.options) {
              if (key in graph &&
                  graph[key] !== this.options[key] &&
                  !this.overrides[key]) {
                this.numOverrides++
                this.overrides[key] = []
              }
            }
            if (this.numOverrides < this.numOptions) {
              processModelClass(relationInstances[name].relatedModelClass)
            }
          }
        }
        processed[name] = true
      }
    }

    processModelClass(this.rootModelClass)
  }

  /**
   * Fills the empty override arrays collected by collectOverrides() by walking
   * through the actual graph and finding relations that have overrides, and
   * building relation paths for them.
   */
  processOverrides() {
    const exp = RelationExpression.fromModelGraph(this.data)
    const overrides = Object.entries(this.overrides) // Cache for repeated use.

    const processExpression = (exp, modelClass, relation, relationPath) => {
      relationPath = relationPath ? `${relationPath}.${exp.name}` : exp.name
      if (relation) {
        // Loop through all override options, figure out their settings for the
        // current relation and build relation expression arrays for each
        // override, reflecting their nested settings in arrays of expressions.
        for (const [key, override] of overrides) {
          const option = pick(relation.graph?.[key], this.options[key])
          if (option) {
            override.push(relationPath)
          }
        }
      }
      if (exp.numChildren > 0) {
        const { relations } = modelClass.definition
        const relationInstances = modelClass.getRelations()
        for (const child of Object.values(exp.children)) {
          const { relatedModelClass } = relationInstances[child.name]
          processExpression(
            child, relatedModelClass, relations[child.name], relationPath
          )
        }
      }
    }

    processExpression(exp, this.rootModelClass)

    // It may be that the relations with overrides aren't actually contained in
    // the graph. If that's the case, fall back to the default values:
    for (const [key, override] of overrides) {
      if (!override.length) {
        delete this.overrides[key]
        this.numOverrides--
      }
    }
  }

  /**
   * Handles relate option by detecting Objection instances in the graph and
   * converting them to shallow id links.
   *
   * For details, see:
   * https://gitter.im/Vincit/objection.js?at=5a4246eeba39a53f1aa3a3b1
   */
  processRelates(data, dataPath = [], relationPath = []) {
    if (data) {
      if (data.$isObjectionModel) {
        const relations = data.constructor.getRelations()
        const shallow = data.$hasId()
        const clone = data.$clone({ shallow })
        if (shallow) {
          // Fill removedRelations with json-pointer -> relation-value pairs,
          // so that we can restore the relations again after the operation in
          // restoreRelations():
          let { relate } = this.overrides
          if (relate) {
            // See if the relate overrides contain this particular relation-Path
            // and only remove and restore relation data if relate is to be used
            relate = relate.includes(relationPath.join('/'))
          } else {
            relate = this.options.relate
          }
          if (relate && this.removedRelations) {
            const values = {}
            let hasRelations = false
            for (const key in relations) {
              if (key in data) {
                values[key] = data[key]
                hasRelations = true
              }
            }
            if (hasRelations) {
              this.removedRelations[dataPath.join('/')] = values
            }
          }
        } else {
          for (const key in relations) {
            // Set relate to true for nested objects, so nested relations end
            // up having it set.
            clone[key] = this.processRelates(clone[key], [...dataPath, key],
              [...relationPath, key])
          }
        }
        return clone
      } else if (isArray(data)) {
        // Pass on relate for hasMany arrays.
        return data.map((entry, index) =>
          this.processRelates(entry, [...dataPath, index], relationPath))
      }
    }
    return data
  }

  /**
   * Restores relations in the final result removed by processRelates()
   */
  restoreRelations(result) {
    if (this.removedRelations) {
      const data = asArray(result)
      for (const [path, values] of Object.entries(this.removedRelations)) {
        const obj = getDataPath(data, path)
        for (const key in values) {
          obj[key] = values[key]
        }
      }
    }
    return result
  }
}
