import { isArray } from '@ditojs/utils'
import { ensureModelArray, createControlPropError } from './graph.js'
import { removedProp } from './records.js'
import { GraphError } from '../errors/index.js'

// With `options.delta`, `data` holds only what changed. Its to-many relations
// keep the rows that it leaves out, and remove marked rows as their `removed`
// setting in the relation's `graphOptions` says, which the call can't override.
// To-one values keep the settings of their relation, so another record or
// `null` replaces the related record, as without deltas.
export class GraphProcessor {
  constructor(
    rootModelClass,
    data,
    { delta = false, ...options } = {},
    defaults
  ) {
    // The call's settings come after the generated ones and would win over the
    // `preserve` of deltas, so that rows left out would be removed:
    if (
      delta &&
      Object.values(options.relations ?? {}).some(
        settings => settings?.removed !== undefined
      )
    ) {
      throw new GraphError(
        "Deltas don't take `removed` settings in `relations`."
      )
    }
    this.rootModelClass = rootModelClass
    this.options = options
    this.delta = delta
    this.defaults = defaults
    // The generated settings, resolved settings and pivot table extras of each
    // relation path, and with `delta`, the `removed` settings of the to-many
    // relations:
    this.relations = {}
    this.settings = {}
    this.extras = {}
    this.removed = {}
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
      // Only `processGraph()` adds markers, as `rejectGraphControlProps()`
      // rejects them in the data of clients:
      ...(this.delta && { allowMarkers: true }),
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
        if (data[removedProp] !== undefined) {
          return this.processRemoved(data, relationPath)
        } else if (
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
              const settings = this.getRelationSettings(relation)
              const keepsRows = (
                this.delta &&
                !constructor.getRelation(name).isOneToOne()
              )
              // Bracket the keys of the generated settings, e.g.
              // `[chapters.book]`, so they don't clash with the call's keys:
              this.relations[`[${key}]`] ??= keepsRows
                ? { ...settings, removed: 'preserve' }
                : settings
              this.extras[key] ??= relation.through?.extra
              if (keepsRows) {
                this.removed[key] ??= settings.removed
              }
              const value = this.processGraph(data[name], path)
              if (value === undefined) {
                delete copy[name]
              } else {
                copy[name] = value
              }
            }
          }
          return copy
        }
      } else if (isArray(data)) {
        // Potentially a has-many relation, so keep processing. Removed rows
        // that their relation preserves leave the list:
        return data
          .map(entry => this.processGraph(entry, relationPath))
          .filter(entry => entry !== undefined)
      }
    }
    return data
  }

  // Mark a removed row to be deleted or unrelated, or leave it out if its
  // relation preserves removed rows. Only to-many relations of deltas hold
  // removed rows:
  processRemoved(model, relationPath) {
    const removed = this.removed[relationPath.join('.')]
    if (model[removedProp] !== true || !removed) {
      throw createControlPropError(removedProp, relationPath)
    } else if (removed !== 'preserve') {
      const { constructor } = model
      const reference = constructor.getReference(model)
      reference[
        removed === 'delete'
          ? constructor.graphDeleteProp
          : constructor.graphUnrelateProp
      ] = true
      return reference
    }
  }
}

function isRelatable(model) {
  // Only models with an id or an Objection.js #ref can be related, new models
  // need to keep their data to be inserted:
  return model.$hasId() || model[model.constructor.uidRefProp] !== undefined
}
