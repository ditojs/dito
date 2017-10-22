import objection from 'objection'
import util from 'util'
import { isObject, underscore, camelize } from '@/utils'
import { convertSchema, convertRelations } from './schema'
import { ValidationError } from '@/errors'
import QueryBuilder from './QueryBuilder'
import EventEmitterMixin from './EventEmitterMixin'

export default class Model extends objection.Model {
  static get definition() {
    const definition = {}

    // Merge definitions up the inheritance chain and reflect the merged result
    // in `modelClass.definition[name]`:
    const getDefinition = name => {
      let merged = null
      let modelClass = this
      while (modelClass !== objection.Model) {
        const object = definitionHandlers[name](modelClass[name])
        if (isObject(object)) {
          merged = Object.assign(merged || {}, object)
        }
        modelClass = Object.getPrototypeOf(modelClass)
      }
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

  static getCached(name, calculate) {
    const _cached = this._cached || (this._cached = {})
    let cached = _cached[name]
    if (cached === undefined) {
      _cached[name] = cached = calculate()
    }
    return cached
  }

  static setCached(name, value) {
    const _cached = this._cached || (this._cached = {})
    _cached[name] = value
  }

  static get jsonSchema() {
    return this.getCached('jsonSchema', () => {
      let schema = null
      const { properties } = this.definition
      if (properties) {
        // Temporarily set the jsonSchema cache to an empty object so that
        // convertSchema() can call getIdProperty() without an endless recursion
        this.setCached('jsonSchema', {})
        schema = this.convertSchema(properties)
      }
      console.log(util.inspect(schema, { depth: 10 }))
      return schema
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
    ))
  }

  static get dateAttributes() {
    return this.getCached('dateAttributes', () => (
      this.getAttributesWithTypes(['date', 'datetime', 'timestamp'])
    ))
  }

  static convertSchema(properties) {
    const jsonSchema = convertSchema(properties)
    const jsonProperties = jsonSchema.properties
    ensureProperty(jsonProperties, this.getIdProperty())
    for (const relation of Object.values(this.getRelations())) {
      for (const property of relation.ownerProp.props) {
        ensureProperty(jsonProperties, property)
      }
    }
    return {
      id: this.name,
      $schema: 'http://json-schema.org/draft-06/schema#',
      ...jsonSchema,
      additionalProperties: false
    }
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

function ensureProperty(properties, name, type = 'integer') {
  const exists = name in properties
  if (!exists) {
    properties[name] = { type }
  }
  return exists
}

function normalizeProperties(object, translate) {
  const converted = {}
  for (const key in object) {
    converted[translate(key)] = object[key]
  }
  return converted
}

EventEmitterMixin(Model)

const definitionHandlers = {
  properties: properties => {
    if (properties) {
      const converted = {}
      // Convert short-form `name: type` to `name: { type }`.
      for (const [name, property] of Object.entries(properties)) {
        converted[name] = isObject(property) ? property : { type: property }
      }
      return converted
    }
  },

  relations: relations => relations,
  methods: methods => methods,
  routes: routes => routes,
  events: events => events
}
