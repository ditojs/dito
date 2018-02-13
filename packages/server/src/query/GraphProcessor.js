import { RelationExpression } from 'objection'
import { isArray, asArray, pick, getDataPath } from '@ditojs/utils'

export default class GraphProcessor {
  constructor(rootModelClass, data, options, settings) {
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
    if (settings.processOverrides) {
      this.collectOverrides()
      if (this.numOverrides > 0) {
        this.processOverrides()
      }
    }
    this.removedRelations = settings.restoreRelations && {}
  }

  getOptions() {
    return this.numOverrides > 0
      ? { ...this.options, ...this.overrides }
      : this.options
  }

  getData() {
    // If setting.restoreRelations is used, call processRelate() to filter out
    // nested relations of models that are used for relates, but keep the
    // removed relations to restore them again on the results.
    // See: restoreRelations()
    const data = this.removedRelations
      ? this.processRelates(this.data)
      : this.data
    return this.isArray ? data : data[0]
  }

  getGraphOptions(relation) {
    // When a relation is owner of its data, then a fall-back for `graphOptions`
    // is provided where both `relate` and `unrelate` id disabled, resulting in
    // inserts and deletes instead.
    const ownerOptions = {
      relate: false,
      unrelate: false
    }
    // Determine the `graphOptions` to be used for this relation.
    return relation.graphOptions || relation.owner && ownerOptions || {}
  }

  /**
   * Loops through all nested relations and finds the ones that define local
   * overrides of the global options, then collects empty override arrays for
   * each setting, so processOverrides() can fill them if any overrides exist.
   */
  collectOverrides() {
    // TODO: Should we very switch to our own implementation of *AndFetch()
    // methods and thus always call `RelationExpression.fromModelGraph(data)`,
    // we may want optimize this code to only collect the overrides for the
    // relations that are actually used in the graph?
    const processed = {}
    const processModelClass = modelClass => {
      const { name } = modelClass
      // Only process each modelClass once, to avoid circular reference loops.
      if (!processed[name]) {
        processed[name] = true
        const { relations } = modelClass.definition
        const relationInstances = modelClass.getRelations()
        for (const [name, relation] of Object.entries(relations)) {
          const graphOptions = this.getGraphOptions(relation)
          if (graphOptions) {
            // Loop through `this.options` and only look for overrides of them,
            // since `relation.graphOptions` is across insert  / upsert & co.,
            // but not all of them use all options (insert defines less).
            for (const key in this.options) {
              if (key in graphOptions &&
                  graphOptions[key] !== this.options[key] &&
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
        const graphOptions = this.getGraphOptions(relation)
        // Loop through all override options, figure out their settings for the
        // current relation and build relation expression arrays for each
        // override, reflecting their nested settings in arrays of expressions.
        for (const [key, override] of overrides) {
          const option = pick(graphOptions[key], this.options[key])
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
    // the graph. If that's the case,delete and fall back to the default values:
    for (const [key, override] of overrides) {
      if (!override.length) {
        delete this.overrides[key]
        this.numOverrides--
      }
    }
  }

  shouldRelate(relationPath) {
    // Root objects (relationPath.length === 0) should never relate.
    if (relationPath.length) {
      const { relate } = this.overrides
      return relate
        // See if the relate overrides contain this particular relation-Path
        // and only remove and restore relation data if relate is to be used
        ? relate.includes(relationPath.join('/'))
        : this.options.relate
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
        const relate = this.shouldRelate(relationPath)
        const clone = data.$clone({ shallow: relate })
        if (relate) {
          // Fill removedRelations with json-pointer -> relation-value pairs,
          // so that we can restore the relations again after the operation in
          // restoreRelations():
          if (this.removedRelations) {
            const values = {}
            let hasRelations = false
            for (const key in relations) {
              if (key in data) {
                const value = data[key]
                if (value !== undefined) {
                  values[key] = value
                  hasRelations = true
                }
              }
            }
            if (hasRelations) {
              this.removedRelations[dataPath.join('/')] = values
            }
          }
        } else {
          for (const key in relations) {
            const value = this.processRelates(
              clone[key],
              [...dataPath, key],
              [...relationPath, key]
            )
            if (value !== undefined) {
              clone[key] = value
            }
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
    const data = asArray(result)
    for (const [path, values] of Object.entries(this.removedRelations || {})) {
      const obj = getDataPath(data, path)
      for (const key in values) {
        obj[key] = values[key]
      }
    }
    return result
  }
}
