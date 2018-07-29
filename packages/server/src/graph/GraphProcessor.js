import { isArray, asArray, getDataPath } from '@ditojs/utils'
import { modelGraphToExpression, ensureModelArray } from '.'

export class GraphProcessor {
  constructor(rootModelClass, data, options = {}, settings = {}) {
    this.rootModelClass = rootModelClass
    this.data = ensureModelArray(rootModelClass, data)
    this.isArray = isArray(data)
    this.options = options
    this.settings = settings
    this.overrides = {}
    this.numOptions = Object.keys(options).length
    this.numOverrides = 0
    if (settings.processOverrides) {
      this.collectOverrides()
      if (this.numOverrides > 0) {
        this.processOverrides()
      }
    }
    this.relateProperties = {}
  }

  getOptions() {
    return this.numOverrides > 0
      ? { ...this.options, ...this.overrides }
      : this.options
  }

  getData() {
    // If setting.processRelates is used, call processRelate() to filter out
    // nested relations of models that are used for relates.
    const data = this.settings.processRelates
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
    // TODO: we may want optimize this code to only collect the overrides for
    // the relations that are actually used in the graph, e.g. through
    // `modelGraphToExpression(data)`. Should we ever switch to our own
    // implementation of *AndFetch() methods, we already have to call this.
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
            // Keep scanning until we're done or found that all options have
            // overrides.
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
    const node = modelGraphToExpression(this.data)

    const processExpression =
      (node, modelClass, relation, relationPath = '') => {
        if (relation) {
          const graphOptions = this.getGraphOptions(relation)
          // Loop through all override options, figure out their settings for
          // the current relation and build relation expression arrays for each
          // override reflecting their nested settings in arrays of expressions.
          for (const key in this.overrides) {
            const option = graphOptions[key] ?? this.options[key]
            if (option) {
              this.overrides[key].push(relationPath)
            }
          }
        }

        const { relations } = modelClass.definition
        const relationInstances = modelClass.getRelations()
        for (const key in node) {
          const child = node[key]
          const { relatedModelClass } = relationInstances[key]
          processExpression(
            child,
            relatedModelClass,
            relations[key],
            appendPath(relationPath, '.', key)
          )
        }
      }

    processExpression(node, this.rootModelClass)
  }

  shouldRelate(relationPath) {
    // Root objects (relationPath === '') should never relate.
    if (relationPath !== '') {
      const { relate } = this.overrides
      return relate
        // See if the relate overrides contain this particular relation-Path
        // and only remove and restore relation data if relate is to be used
        ? relate.includes(relationPath)
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
  processRelates(data, relationPath = '', dataPath = '') {
    if (data) {
      if (data.$isObjectionModel) {
        // Start with a reference model instance that only contains the
        // id / #ref fields:
        const copy = data.constructor.getReference(data)
        if (this.shouldRelate(relationPath)) {
          if (this.settings.restoreRelates) {
            // Fill relateProperties with entries mapping dataPath->properties,
            // so we can restore these again at the end of in restoreRelates():
            const properties = {}
            if (this.copyProperties(properties, data, copy)) {
              this.relateProperties[dataPath] = properties
            }
          }
        } else {
          // This isn't a relate, so copy over the full properties of data now:
          this.copyProperties(copy, data, copy)
          // Follow all relations and keep processing:
          for (const { name } of data.constructor.getRelationArray()) {
            if (name in data) {
              copy[name] = this.processRelates(
                data[name],
                appendPath(relationPath, '.', name),
                appendPath(dataPath, '/', name)
              )
            }
          }
        }
        return copy
      } else if (isArray(data)) {
        // Potentially a has-many relation, so keep processing relates:
        return data.map((entry, index) => this.processRelates(
          entry,
          relationPath,
          appendPath(dataPath, '/', index)
        ))
      }
    }
    return data
  }

  /**
   * Restores relations in the final result removed by processRelates()
   */
  restoreRelates(result) {
    // `this.data` is always an array, hence the dataPaths always point into
    // arrays. Convert the result to an array so the same paths can be used.
    if (this.settings.restoreRelates) {
      const data = asArray(result)
      for (const entry of Object.entries(this.relateProperties)) {
        const [dataPath, properties] = entry
        const obj = getDataPath(data, dataPath)
        for (const key in properties) {
          obj[key] = properties[key]
        }
      }
    }
    return result
  }

  copyProperties(target, source, exclude) {
    let copied = false
    for (const [key, value] of Object.entries(source)) {
      if (!exclude || !(key in exclude)) {
        target[key] = value
        copied = true
      }
    }
    return copied
  }
}

function appendPath(path, separator, token) {
  return path !== '' ? `${path}${separator}${token}` : token
}
