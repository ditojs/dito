import objection from 'objection'
import { isObject, underscore, camelize } from '@/utils'
import { ValidationError } from '@/errors'
import convertSchema from './convertSchema'
import convertRelations from './convertRelations'
import QueryBuilder from './QueryBuilder'
import EventEmitterMixin from './EventEmitterMixin'

const definitionMap = new WeakMap()
const cacheMap = new WeakMap()

export default class Model extends objection.Model {
  static get definition() {
    // Check if we already have a definition object for this class and return it
    let definition = definitionMap.get(this)
    if (definition) {
      return definition
    }

    // If no definition object was defined yet, create one with accessors for
    // each entry in `definitionHandlers`. Each of these getters when called
    // merge definitions up the inheritance chain and store the merged result
    // in `modelClass.definition[name]` for further caching.
    const getDefinition = name => {
      let merged
      let modelClass = this
      const { each, final } = definitionHandlers[name]
      while (modelClass !== objection.Model) {
        let object = modelClass[name]
        if (isObject(object)) {
          object = each && each.call(this, object) || object
          merged = Object.assign(merged || {}, object)
        }
        modelClass = Object.getPrototypeOf(modelClass)
      }
      // Once calculated, override definition getter with merged value
      if (final && merged) {
        // Override definition before calling final(), to prevent endless
        // recursion with interdependent definition related calls...
        setDefinition(name, { value: merged }, true)
        merged = final.call(this, merged) || merged
        // NOTE: Now that it changed, setDefinition() is called once more below.
      }
      if (merged) {
        setDefinition(name, { value: merged }, false)
      } else {
        delete definition[name]
      }
      return merged
    }

    const setDefinition = (name, property, configurable) => {
      Object.defineProperty(definition, name, {
        ...property,
        configurable,
        enumerable: true
      })
    }

    definitionMap.set(this, definition = {})
    for (const name in definitionHandlers) {
      setDefinition(name, { get: () => getDefinition(name) }, true)
    }
    return definition
  }

  async $update(attributes) {
    const updated = await this.$query().updateAndFetch(attributes)
    return this.$set(updated)
  }

  async $patch(attributes) {
    const patched = await this.$query().patchAndFetch(attributes)
    return this.$set(patched)
  }

  get $app() {
    return this.constructor.app
  }

  $formatDatabaseJson(json) {
    for (const key of this.constructor.dateAttributes) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date && date.toISOString ? date.toISOString() : date
      }
    }
    if (this.constructor.app.normalizeDbNames) {
      json = normalizeProperties(json, underscore)
    }
    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json)
    if (this.constructor.app.normalizeDbNames) {
      json = normalizeProperties(json, camelize)
    }
    for (const key of this.constructor.dateAttributes) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date ? new Date(date) : date
      }
    }
    return json
  }

  static get tableName() {
    // Convention: Use the class name as the tableName, plus normalization:
    return this.app.normalizeDbNames ? underscore(this.name) : this.name
  }

  static get idColumn() {
    const { properties = {} } = this.definition
    const ids = []
    for (const [name, property] of Object.entries(properties)) {
      if (property.id) {
        ids.push(this.propertyNameToColumnName(name))
      }
    }
    const { length } = ids
    return length > 1 ? ids : length > 0 ? ids[0] : super.idColumn
  }

  static getAttributesWithTypes(types) {
    const attributes = []
    const { properties = {} } = this.definition
    for (const [name, property] of Object.entries(properties)) {
      if (types.includes(property.type)) {
        attributes.push(name)
      }
    }
    return attributes
  }

  static getCached(name, calculate, empty = {}) {
    if (!cacheMap.has(this)) {
      cacheMap.set(this, {})
    }
    const cache = cacheMap.get(this)
    let cached = cache[name]
    if (cached === undefined) {
      // Temporarily set cache to an empty object to prevent endless recursion
      // with interdependent jsonSchema related calls...
      cache[name] = empty
      cache[name] = cached = calculate()
    }
    return cached
  }

  static get jsonSchema() {
    return this.getCached('jsonSchema', () => {
      const { properties } = this.definition
      return properties ? {
        id: this.name,
        $schema: 'http://json-schema.org/draft-06/schema#',
        ...convertSchema(properties),
        additionalProperties: false
      } : null
    })
  }

  static get relationMappings() {
    return this.getCached('relationMappings', () => {
      const { relations } = this.definition
      return relations
        ? convertRelations(this, relations, this.app.models)
        : null
    })
  }

  static get jsonAttributes() {
    return this.getCached('jsonAttributes', () => (
      this.getAttributesWithTypes(['object', 'array'])
    ), [])
  }

  static get dateAttributes() {
    return this.getCached('dateAttributes', () => (
      this.getAttributesWithTypes(['date', 'datetime', 'timestamp'])
    ), [])
  }

  static prepareModel() {
    const exposeRelated = (name, accessor) => {
      if (!(accessor in this.prototype)) {
        Object.defineProperty(this.prototype, accessor, {
          get() {
            return this.$relatedQuery(name)
          },
          configurable: false,
          enumerable: false
        })
      }
    }

    for (const [name, relation] of Object.entries(this.getRelations())) {
      // Expose $relatedQuery(name) under short-cut $name, and also $$name,
      // in case $name clashes with a function:
      exposeRelated(name, `$${name}`)
      exposeRelated(name, `$$${name}`)
      // Make sure all relations are defined correctly, with back-references.
      const { relatedModelClass } = relation
      const relatedProperties = relatedModelClass.definition.properties || {}
      for (const property of relation.relatedProp.props) {
        if (!(property in relatedProperties)) {
          throw new Error(
            `\`${relatedModelClass.name}\` is missing back-reference for ` +
            `relation \`${this.name}.${relation.name}\``
          )
        }
      }
      // TODO: Check `through` settings also
    }
    this.getValidator().precompileModel(this)
    // Install all events listed in the static events object.
    const { events = {} } = this.definition
    for (const [event, handler] of Object.entries(events)) {
      this.on(event, handler)
    }
  }

  static createValidator() {
    // Use a shared validator per app, so model schemas can reference each other
    return this.app.validator
  }

  static createValidationError(errors) {
    return new this.ValidationError(errors,
      `The provided data for the ${this.name} instance is not valid`)
  }

  static ValidationError = ValidationError
  static QueryBuilder = QueryBuilder
}

EventEmitterMixin(Model)

const definitionHandlers = {
  properties: {
    each(properties) {
      const converted = {}
      // Convert short-form `name: type` to `name: { type }`.
      for (const [name, property] of Object.entries(properties)) {
        converted[name] = isObject(property) ? property : { type: property }
      }
      return converted
    },

    final(properties) {
      // Include auto-generated 'id' properties for models and relations.
      const missing = {}
      function includeProperty(name, type = 'integer') {
        if (!(name in properties)) {
          missing[name] = { type }
        }
      }

      includeProperty(this.getIdProperty())
      for (const relation of Object.values(this.getRelations())) {
        for (const property of relation.ownerProp.props) {
          includeProperty(property)
        }
      }
      return {
        ...missing,
        ...properties
      }
    }
  },

  relations: {},
  methods: {},
  routes: {},
  events: {}
}

function normalizeProperties(object, translate) {
  const converted = {}
  for (const key in object) {
    converted[translate(key)] = object[key]
  }
  return converted
}
