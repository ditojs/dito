import objection from 'objection'
import findQuery from 'objection-find'
import util from 'util'
import { convertSchema, convertRelations } from './schema'
import Validator from './Validator'
import ValidationError from './ValidationError'
import * as validators from '../validators' // TODO: Move to app!

const validator = new Validator({ validators })

export default class Model extends objection.Model {
  static get tableName() {
    // Simple convention: Use the constructor name as the tableName
    return this.name
  }

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

  static getFindQuery() {
    let { _findQuery } = this
    if (!_findQuery) {
      _findQuery = this._findQuery = findQuery(this)
    }
    return _findQuery
  }

  static getDateProperties() {
    let keys = this._dateProperties
    if (!keys) {
      keys = this._dateProperties = []
      const { properties } = this.getJsonSchema() || {}
      for (const [key, { format }] of Object.entries(properties || {})) {
        if (format === 'date' || format === 'date-time') {
          keys.push(key)
        }
      }
    }
    return keys
  }

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json)
    for (const key of this.constructor.getDateProperties()) {
      const date = json[key]
      json[key] = date ? new Date(date) : date
    }
    return json
  }

  static createValidator() {
    return validator
  }

  static createValidationError(errors) {
    return new this.ValidationError(errors,
      `The provided data for the ${this.name} instance is not valid`)
  }

  static get jsonSchema() {
    let { _jsonSchema, properties } = this
    if (!_jsonSchema && properties) {
      const base = Object.getPrototypeOf(this)
      const inherit = base !== Model
      const jsonObject = convertSchema(properties, this.getValidator())
      const jsonProperties = jsonObject.properties
      // Temporarily set _jsonSchema to an empty object so that we can call
      // getIdProperty() without causing an endless recursion:
      this._jsonSchema = {}
      ensureProperty(jsonProperties, this.getIdProperty())
      for (const relation of Object.values(this.getRelations())) {
        for (const property of relation.ownerProp.props) {
          ensureProperty(jsonProperties, property)
        }
      }
      _jsonSchema = this._jsonSchema = {
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
      console.log(util.inspect(_jsonSchema, { depth: 3 }))
    }
    return _jsonSchema
  }

  static get jsonSchemaObject() {
    // Easy access to main JSON schema object, that sometimes is nested when
    // inheritance is used
    const { jsonSchema } = this
    const $merge = jsonSchema && jsonSchema.$merge
    return $merge ? $merge.with : (jsonSchema || null)
  }

  static get jsonSchemaProperties() {
    const { jsonSchemaObject } = this
    return jsonSchemaObject && jsonSchemaObject.properties || null
  }

  static get relationMappings() {
    let { _relationMappings, relations } = this
    if (!_relationMappings && relations) {
      _relationMappings = this._relationMappings = convertRelations(this,
        relations, this.app.models)
    }
    return _relationMappings
  }

  static checkSchema() {
    for (const relation of Object.values(this.getRelations())) {
      const { relatedModelClass } = relation
      const relatedProperties = relatedModelClass.jsonSchemaProperties
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

  static ValidationError = ValidationError
}

function ensureProperty(properties, property, type = 'integer') {
  const exists = property in properties
  if (!exists) {
    properties[property] = { type }
  }
  return exists
}
