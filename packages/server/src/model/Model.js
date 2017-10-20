import objection from 'objection'
import util from 'util'
import { isObject, underscore, camelize } from '@/utils'
import { convertSchema, convertRelations } from './schema'
import { ValidationError } from '@/errors'
import QueryBuilder from './QueryBuilder'
import EventEmitterMixin from './EventEmitterMixin'

export default class Model extends objection.Model {
  static find(params) {
    // NOTE: All the parsing magic happens through our extended QueryBuilder:
    return this.query().find(params)
  }

  static findOne(params) {
    return this.find(params).first()
  }

  static findById(id) {
    return this.query().findById(id)
  }

  static insert(data) {
    return this.query().insert(data)
  }

  async $patch(attributes) {
    const patched = await this.$query().patchAndFetch(attributes)
    return this.$set(patched)
  }

  async $update(attributes) {
    const updated = await this.$query().updateAndFetch(attributes)
    return this.$set(updated)
  }

  get $app() {
    return this.constructor.app
  }

  $formatDatabaseJson(json) {
    for (const key of this.constructor.getDateProperties()) {
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
    for (const key of this.constructor.getDateProperties()) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date ? new Date(date) : date
      }
    }
    return json
  }

  static getDateProperties() {
    let { _dateProperties } = this
    if (!_dateProperties) {
      _dateProperties = this._dateProperties = []
      const properties = this.getJsonSchemaProperties()
      for (const [key, { format }] of Object.entries(properties || {})) {
        if (format === 'date' || format === 'date-time') {
          _dateProperties.push(key)
        }
      }
    }
    return _dateProperties
  }

  static get tableName() {
    // Convention: Use the class name as the tableName, plus normalization:
    return this.app.normalizeDbNames ? underscore(this.name) : this.name
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

  static getMerged(name) {
    // Merges all properties objects up the inheritance chain to one object.
    return this.getCached(name, () => {
      let merged = null
      let modelClass = this
      while (modelClass !== objection.Model) {
        const object = modelClass[name]
        if (isObject(object)) {
          merged = Object.assign(merged || {}, object)
        }
        modelClass = Object.getPrototypeOf(modelClass)
      }
      return merged
    })
  }

  static getMergedProperties() {
    return this.getMerged('properties')
  }

  static getMergedRelations() {
    return this.getMerged('relations')
  }

  static getMergedMethods() {
    return this.getMerged('methods')
  }

  static getMergedRoutes() {
    return this.getMerged('routes')
  }

  static getMergedEvents() {
    return this.getMerged('events')
  }

  static get jsonSchema() {
    return this.getCached('jsonSchema', () => {
      const properties = this.getMergedProperties()
      let schema = null
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
      const relations = this.getMergedRelations()
      return relations
        ? convertRelations(this, relations, this.app.models)
        : null
    })
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

  static getJsonSchemaProperties() {
    const schema = this.getJsonSchema()
    return schema && schema.properties || null
  }

  static prepareModel() {
    // Make sure all relations are defined correctly, with back-references.
    for (const relation of Object.values(this.getRelations())) {
      const { relatedModelClass } = relation
      const relatedProperties = relatedModelClass.getJsonSchemaProperties()
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
    const events = this.getMergedEvents()
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

function ensureProperty(properties, property, type = 'integer') {
  const exists = property in properties
  if (!exists) {
    properties[property] = { type }
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
