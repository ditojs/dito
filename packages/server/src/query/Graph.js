import { RelationExpression } from 'objection'
import { isObject, isArray, asArray, pick } from '@/utils'

export default class Graph {
  constructor(rootModelClass, data, upsert, options) {
    this.rootModelClass = rootModelClass
    // Performs the same as `this.data = rootModelClass.ensureModelArray(data)`:
    this.data = data
      ? asArray(data).map(model =>
        !model ? null
        : model instanceof rootModelClass ? model
        : rootModelClass.fromJson(model)
      )
      : []
    this.upsert = upsert
    this.options = options
    this.overrides = {}
    this.numOptions = Object.keys(options).length
    this.numOverrides = 0
    this.collectOverrides()
    if (this.numOverrides > 0) {
      this.processOverrides()
    }
  }

  getOptions() {
    return this.numOverrides > 0
      ? { ...this.options, ...this.overrides }
      : this.options
  }

  getData() {
    // TODO: On inserts with relates, we need to filter out the nested data of
    // nested models ($isObjectionModel === true), but keep the nested data
    // and set it again on the results. Consider using json points to do so:
    // https://github.com/manuelstofer/json-pointer
    // But even this won't work for validations, as the data removed there will
    // still be missing :/, so see if we can fix/improve in objection instead?
    return this.upsert ? this.data : processGraph(this.data, this.options)
  }

  get optionName() {
    return this.upsert ? 'upsert' : 'insert'
  }

  /**
   * Loops through all nested relations and finds the ones that define local
   * overrides of the global options, then collects empty override arrays for
   * each setting, so processOverrides() can fill them if any overrides exist.
   */
  collectOverrides() {
    const { optionName } = this

    const processed = {}
    const processModelClass = modelClass => {
      const { name } = modelClass
      if (!processed[name]) {
        const relationDefinitions = modelClass.definition.relations
        const relationInstances = modelClass.getRelations()
        for (const [name, relation] of Object.entries(relationDefinitions)) {
          const options = relation[optionName]
          if (options) {
            for (const key in options) {
              if (!this.overrides[key] && options[key] !== this.options[key]) {
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

  processOverrides() {
    const { optionName } = this
    const exp = RelationExpression.fromGraph(this.data)
    const overrides = Object.entries(this.overrides) // Cache for repeated use.

    const processExpression = (exp, modelClass, relation, path) => {
      path = path ? `${path}.${exp.name}` : exp.name
      if (relation) {
        // Loop through all override options, figure out their settings for the
        // current relation and build relation expression arrays for each
        // override, reflecting their nested settings in arrays of expressions.
        const options = relation[optionName]
        for (const [key, override] of overrides) {
          const option = pick(options?.[key], this.options[key])
          if (option) {
            override.push(path)
          }
        }
      }
      if (exp.numChildren > 0) {
        const relationDefinitions = modelClass.definition.relations
        const relationInstances = modelClass.getRelations()
        for (const child of Object.values(exp.children)) {
          const { relatedModelClass } = relationInstances[child.name]
          processExpression(child, relatedModelClass,
            relationDefinitions[child.name], path)
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
}

export function processGraph(data, opt) {
  // processGraph() handles relate option by detecting Objection instances in
  // the graph and converting them to shallow id links. For details, see:
  // https://gitter.im/Vincit/objection.js?at=5a4246eeba39a53f1aa3a3b1
  const processRelate = (data, relate) => {
    if (data) {
      if (data.$isObjectionModel && relate) {
        // Shallow-clone to avoid relations causing problems
        // TODO: Ideally, there would be a switch in Objection that would tell
        // `relate: true` to behave this way with `$isObjectionModel` but still
        // would allow referencing deep models. Check with @koskimas.
        data = data.$clone(true)
      } else if (isArray(data)) {
        // Pass on relate for arrays
        data = data.map(entry => processRelate(entry, relate))
      } else if (isObject(data)) {
        // Set relate to true for nested objects, so nested relations end up
        // having it set.
        const processed = {}
        for (const key in data) {
          processed[key] = processRelate(data[key], true)
        }
        data = processed
      }
    }
    return data
  }

  return opt.relate ? processRelate(data, false) : data
}
