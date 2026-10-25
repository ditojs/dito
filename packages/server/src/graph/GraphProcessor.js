import { isArray } from '@ditojs/utils'
import { RelationExpression } from 'objection'
import { ensureModelArray } from './graph.js'

export class GraphProcessor {
  constructor(rootModelClass, data, options = {}, defaults) {
    this.options = options
    this.defaults = defaults
    // The settings of `options.relations`, with their parsed expressions:
    this.entries = Object.entries(options.relations ?? {}).map(
      ([key, settings]) => ({
        expression: RelationExpression.create(key),
        settings
      })
    )
    // The resolved settings and pivot table extras of each relation path:
    this.relations = {}
    this.extras = {}
    const models = this.processGraph(
      ensureModelArray(rootModelClass, data, { skipValidation: true })
    )
    this.data = isArray(data) ? models : models[0]
  }

  getData() {
    return this.data
  }

  getOptions() {
    const { root, relations, ...options } = this.options
    return {
      ...this.defaults.options,
      ...options,
      strict: true,
      root: { ...this.defaults.options.root, ...root },
      // The resolved settings of each relation path come last and win, while
      // the entries of the call stay for Objection.js to check them:
      relations: { ...relations, ...this.relations }
    }
  }

  getSettings(relation, relationPath) {
    const defaults = relation.owner
      ? this.defaults.owner
      : this.defaults.related
    const settings = { ...defaults, ...relation.graphOptions }
    for (const { expression, settings: overrides } of this.entries) {
      if (matchesExpression(expression, relationPath)) {
        Object.assign(settings, overrides)
      }
    }
    // `graphOptions` serve all graph methods, but `insertGraph()` neither
    // removes nor keeps rows:
    const { removed, kept, ...insertSettings } = settings
    return 'removed' in defaults ? settings : insertSettings
  }

  // Resolve the settings of each relation path in the graph, and reduce the
  // models that are related to references with only their id / #ref and the
  // pivot table's extra properties, so relating them doesn't modify them:
  // https://gitter.im/Vincit/objection.js?at=5a4246eeba39a53f1aa3a3b1
  processGraph(data, relationPath = []) {
    if (data) {
      if (data.$isObjectionModel) {
        const { constructor } = data
        const key = relationPath.join('.')
        if (this.relations[key]?.added === 'relate' && isRelatable(data)) {
          return constructor.getReference(data, this.extras[key])
        } else {
          // This isn't a relate, or a new model without id / #ref that needs
          // to be inserted, so create a shallow clone and process its
          // relations:
          // NOTE: This also copies `$$queryProps`, which is crucial for more
          // advanced Objection.js features to work, e.g. LiteralBuilder:
          const copy = data.$clone({ shallow: true })
          const { relations } = constructor.definition
          for (const name of Object.keys(constructor.getRelations())) {
            if (name in data) {
              const path = [...relationPath, name]
              const key = path.join('.')
              const relation = relations[name]
              this.relations[key] ??= this.getSettings(relation, path)
              this.extras[key] ??= relation.through?.extra
              copy[name] = this.processGraph(data[name], path)
            }
          }
          return copy
        }
      } else if (isArray(data)) {
        // Potentially a has-many relation, so keep processing:
        return data.map(entry => this.processGraph(entry, relationPath))
      }
    }
    return data
  }
}

function isRelatable(model) {
  // Only models with an id or an Objection.js #ref can be related, new models
  // need to keep their data to be inserted:
  return model.$hasId() || model[model.constructor.uidRefProp] !== undefined
}

// Match relation paths like Objection.js matches the keys of `relations`: a
// path matches when it leads to a leaf of the expression, `'*'` matches all
// relations below it, and recursive expressions every level.
function matchesExpression(expression, relationPath) {
  for (const name of relationPath) {
    expression = expression?.childExpression(name)
  }
  return (
    !!expression && (
      expression.node.$allRecursive
        ? expression.recursionDepth > 0
        : expression.isEmpty
    )
  )
}
