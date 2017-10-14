import objection from 'objection'
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

  static create(data) {
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

  static get jsonSchema() {
    let { _jsonSchema, properties } = this
    if (!_jsonSchema && properties) {
      const base = Object.getPrototypeOf(this)
      const inherit = base !== Model
      const jsonObject = convertSchema(properties, this.getValidator())
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
      // console.log(_jsonSchema)
      return _jsonSchema
    }
  }

  static get relationMappings() {
    let { _relationMappings, relations } = this
    if (!_relationMappings && relations) {
      _relationMappings = this._relationMappings = convertRelations(this,
        relations, this.app.models)
      // console.log(_relationMappings)
      return _relationMappings
    }
  }

  static ValidationError = ValidationError
}
