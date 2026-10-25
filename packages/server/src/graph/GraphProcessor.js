import { isArray } from '@ditojs/utils'
import { ensureModelArray } from './graph.js'

export class GraphProcessor {
  constructor(rootModelClass, data, options = {}, defaults) {
    this.rootModelClass = rootModelClass
    this.options = options
    this.defaults = defaults
    // The generated settings, resolved settings and pivot table extras of each
    // relation path:
    this.relations = {}
    this.settings = {}
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
      // The generated settings come first, so the entries of the call override
      // them:
      relations: { ...this.relations, ...relations }
    }
  }

  getRelationSettings(relation) {
    const { operation, owner, related } = this.defaults
    // `graphOptions` serve all graph methods, but `insertGraph()` neither
    // removes nor keeps rows:
    const { removed, kept, ...insertOptions } = relation.graphOptions ?? {}
    return {
      ...(relation.owner ? owner : related),
      ...(operation === 'insert' ? insertOptions : relation.graphOptions)
    }
  }

  getSettings(relationPath) {
    // Let Objection.js resolve the settings of the path from the generated
    // ones and the call's `relations`, as it does when writing the graph:
    const key = relationPath.join('.')
    this.settings[key] ??= this.rootModelClass.getGraphSettings(
      relationPath,
      this.getOptions(),
      this.defaults.operation
    )
    return this.settings[key]
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
        if (
          relationPath.length > 0 &&
          this.getSettings(relationPath).added === 'relate' &&
          isRelatable(data)
        ) {
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
              // Bracket the keys of the generated settings, e.g.
              // `[chapters.book]`, so they don't clash with the call's keys:
              this.relations[`[${key}]`] ??= this.getRelationSettings(relation)
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
