import { isArray } from '@ditojs/utils'
import { ensureModelArray } from './graph.js'
import { modelGraphToExpression } from './expression.js'

export class DitoGraphProcessor {
  constructor(rootModelClass, data, options = {}, settings = {}) {
    this.rootModelClass = rootModelClass
    this.data = ensureModelArray(rootModelClass, data, {
      skipValidation: true
    })
    this.isArray = isArray(data)
    this.options = options
    this.settings = settings
    this.overrides = {}
    this.extras = {}
    this.numOptions = Object.keys(options).length
    this.numOverrides = 0
    if (settings.processOverrides) {
      this.collectOverrides()
      if (this.numOverrides > 0) {
        this.processOverrides()
      }
    }
  }

  getOptions() {
    return {
      ...this.options,
      ...this.overrides
    }
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
    // is provided where both `relate` and `unrelate` is disabled, resulting in
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
    const expr = modelGraphToExpression(this.data)

    const processExpression =
      (expr, modelClass, relation, relationPath = '') => {
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

          // Also collect any many-to-many pivot table extra properties.
          const extra = relation.through?.extra
          if (extra?.length > 0) {
            this.extras[relationPath] = extra
          }
        }

        const { relations } = modelClass.definition
        const relationInstances = modelClass.getRelations()
        for (const key in expr) {
          const childExpr = expr[key]
          const { relatedModelClass } = relationInstances[key]
          processExpression(
            childExpr,
            relatedModelClass,
            relations[key],
            appendPath(relationPath, '.', key)
          )
        }
      }

    processExpression(expr, this.rootModelClass)
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
        const { constructor } = data
        let copy
        if (this.shouldRelate(relationPath)) {
          // For relates, start with a reference model that only contains the
          // id / #ref fields, and any many-to-many pivot table extra values:
          copy = constructor.getReference(data, this.extras[relationPath])
        } else {
          // This isn't a relate, so create a proper shallow clone:
          // NOTE: This also copies `$$queryProps`, which is crucial for more
          // advanced Objection.js features to work, e.g. LiteralBuilder:
          copy = data.$clone({ shallow: true })
          // Follow all relations and keep processing:
          for (const { name } of Object.values(constructor.getRelations())) {
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
}

function appendPath(path, separator, token) {
  return path !== '' ? `${path}${separator}${token}` : token
}
