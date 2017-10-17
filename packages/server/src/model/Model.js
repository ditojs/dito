import objection from 'objection'
import findQuery from 'objection-find'
import util from 'util'
import { snakeCase, camelCase } from '../utils'
import { convertSchema, convertRelations } from './schema'
import ValidationError from './ValidationError'

export default class Model extends objection.Model {
  static find(filter = {}) {
    const builder = this.query()
    // TODO: eager, limit, offset, omit
    const { where/*, eager, limit, offset, omit */ } = filter
    if (where) {
      let first = true
      for (const [key, value] of Object.entries(where)) {
        if (first) {
          builder.where(key, value)
          first = false
        } else {
          builder.andWhere(key, value)
        }
      }
    }
    return builder
  }

  static findOne(filter) {
    return this.find(filter).first()
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
      json = normalizeProperties(json, snakeCase)
    }
    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json)
    if (this.constructor.app.normalizeDbNames) {
      json = normalizeProperties(json, camelCase)
    }
    for (const key of this.constructor.getDateProperties()) {
      const date = json[key]
      if (date !== undefined) {
        json[key] = date ? new Date(date) : date
      }
    }
    return json
  }

  $beforeInsert() {
    if (this.constructor.timestamps) {
      this.createdAt = this.updatedAt = new Date()
    }
  }

  $beforeUpdate() {
    if (this.constructor.timestamps) {
      this.updatedAt = new Date()
    }
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

  static getFindQuery() {
    let { _findQuery } = this
    if (!_findQuery) {
      _findQuery = this._findQuery = findQuery(this)
    }
    return _findQuery
  }

  static get tableName() {
    // Convention: Use the class name as the tableName, plus normalization:
    return this.app.normalizeDbNames ? snakeCase(this.name) : this.name
  }

  static get jsonSchema() {
    let { _jsonSchema, properties } = this
    if (!_jsonSchema && properties) {
      // Temporarily set _jsonSchema to an empty object so convertSchema() can
      // call getIdProperty() without causing an endless recursion:
      this._jsonSchema = {}
      _jsonSchema = this._jsonSchema = this.convertSchema(properties)
      console.log(util.inspect(_jsonSchema, { depth: 3 }))
    }
    return _jsonSchema
  }

  static convertSchema(properties) {
    const base = Object.getPrototypeOf(this)
    const inherit = base !== Model
    if (this.timestamps) {
      properties = {
        ...properties,
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
      }
    }
    const jsonObject = convertSchema(properties, this.getValidator())
    const jsonProperties = jsonObject.properties
    ensureProperty(jsonProperties, this.getIdProperty())
    for (const relation of Object.values(this.getRelations())) {
      for (const property of relation.ownerProp.props) {
        ensureProperty(jsonProperties, property)
      }
    }
    return {
      id: this.name,
      $schema: 'http://json-schema.org/draft-06/schema#',
      ...(inherit
        ? {
          $merge: {
            source: { $ref: base.name },
            with: jsonObject
          }
        }
        : {
          ...jsonObject,
          additionalProperties: false
        }
      )
    }
  }

  static get relationMappings() {
    let { _relationMappings, relations } = this
    if (!_relationMappings && relations) {
      _relationMappings = this._relationMappings = convertRelations(this,
        relations, this.app.models)
    }
    return _relationMappings
  }

  static getJsonSchemaObject() {
    // Easy access to main JSON schema object, that sometimes is nested when
    // inheritance is used
    const schema = this.getJsonSchema()
    const $merge = schema && schema.$merge
    return $merge ? $merge.with : (schema || null)
  }

  static getJsonSchemaProperties() {
    const object = this.getJsonSchemaObject()
    return object && object.properties || null
  }

  static checkSchema() {
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
