import objection from 'objection'
import { isObject, underscore, camelize } from '@/utils'
import { convertSchema, convertRelations } from './schema'
import { ValidationError } from '@/errors'
import QueryBuilder from './QueryBuilder'
import EventEmitterMixin from './EventEmitterMixin'

export default class Model extends objection.Model {
  static get definition() {
    const definition = {}
    const noop = val => val
    // Merge definitions up the inheritance chain and reflect the merged result
    // in `modelClass.definition[name]`:
    const getDefinition = name => {
      let merged = null
      let modelClass = this
      const { each = noop, final = noop } = definitionHandlers[name]
      while (modelClass !== objection.Model) {
        let object = modelClass[name]
        object = object && each.call(this, object) || object
        if (isObject(object)) {
          merged = Object.assign(merged || {}, object)
        }
        modelClass = Object.getPrototypeOf(modelClass)
      }
      merged = merged && final.call(this, merged) || merged
      // Once calculated, override definition getter with merged value
      Object.defineProperty(definition, name, {
        value: merged,
        enumerable: true
      })
      return merged
    }

    for (const name in definitionHandlers) {
      Object.defineProperty(definition, name, {
        get: () => getDefinition(name),
        configurable: true,
        enumerable: true
      })
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

  static getAttributesWithTypes(types) {
    const attributes = []
    const { properties } = this.definition
    for (const [name, property] of Object.entries(properties || {})) {
      if (types.includes(property.type)) {
        attributes.push(name)
      }
    }
    return attributes
  }

  static getCached(name, calculate, empty = {}) {
    const _cached = this._cached || (this._cached = {})
    let cached = _cached[name]
    if (cached === undefined) {
      // Temporarily set cache to an empty object to prevent endless recursion
      // with interdependent jsonSchema related calls...
      _cached[name] = empty
      _cached[name] = cached = calculate()
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
    // Make sure all relations are defined correctly, with back-references.
    for (const relation of Object.values(this.getRelations())) {
      const { relatedModelClass } = relation
      const relatedProperties = relatedModelClass.definition.properties
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
    const { events } = this.definition
    for (const [event, handler] of Object.entries(events || {})) {
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
