import objection from 'objection'
import validator from './validator'
import {isObject, isArray, isString, isFunction, clone} from './utils'

export default class Model extends objection.Model {
  static get tableName() {
    // Simple convention: Use the constructor name as the tableName
    return this.name
  }

  static find(filter = {}) {
    const builder = this.query()
    const {where, eager, limit, offset, omit} = filter
    // TODO: eager, limit, offset, omit
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
      const {properties} = this.getJsonSchema()
      for (const [key, {format}] of Object.entries(properties)) {
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
    let {_jsonSchema, properties} = this
    if (!_jsonSchema && properties) {
      const base = Object.getPrototypeOf(this)
      const inherit = base !== Model
      const jsonObject = this.processJsonSchema({ ...properties },
        { isRoot: true })
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
      console.log(_jsonSchema)
      return _jsonSchema
    }
  }

  static processJsonSchema(schema, {isRoot, isItems} = {}) {
    const typeValue = schema.type
    const type = isFunction(typeValue) ? typeValue.name : typeValue
    if (isArray(type)) {
      // Convert schema array notation to JSON schema
      schema.type = 'array'
      const arrayType = type[0]
      const items = isObject(arrayType)
        ? {...arrayType}
        : { type: arrayType }
      schema.items = this.processJsonSchema(items, { isItems: true })
    } else if (isString(type)) {
      // Convert schema property notation to JSON schema
      const typeLower = type.toLowerCase()
      if (this.jsonTypes[typeLower]) {
        schema.type = typeLower
      } else if (typeLower === 'date') {
        // date properties can be submitted both as a string or a Date object.
        // Provide validation through date-time format, which in AJV appears
        // to handle both types correctly.
        schema.type = ['string', 'object']
        if (!schema.format) {
          schema.format = 'date-time'
        }
      } else {
        console.log('$ref', type)
        // A reference to another model as nested JSON data, use $ref instead
        // of type, but append '_required' to use the version of the schema
        // that has the 'required' keyword defined.
        delete schema.type
        schema.$ref = type
      }
    } else {
      // Root properties schema or nested objects
      const properties = schema
      const required = []
      for (const [key, value] of Object.entries(schema)) {
        const property = isObject(value) ? { ...value } : { type: value }
        if (property.required) {
          required.push(key)
        }
        properties[key] = this.processJsonSchema(property)
      }
      schema = {
        type: 'object',
        properties,
        ...(required.length > 0 && {required})
      }
    }
    if (!isRoot) {
      // Our 'required' is not the same as JSON Schema's: Use the 'required'
      // format instead that only validates if required string is not empty.
      const {required} = schema
      if (required !== undefined) {
        if (required) {
          // Support multiple `format` keywords through `allOf`:
          const {format, allOf} = schema
          if (format || allOf) {
            (allOf || (schema.allOf = [])).push({ format: 'required' })
          } else {
            schema.format = 'required'
          }
        }
        delete schema.required
      }
      if (!required && !isItems) {
        // If not required, add 'null' to the allowed types
        const {type, $ref} = schema
        if (type) {
          schema.type = [...(isArray(type) ? type : [type]), 'null']
        } else if ($ref) {
          schema = {
            anyOf: [schema, { type: 'null' }]
          }
        }
      }
    }
    // Expand multi-line array descriptions into one string.
    const {description} = schema
    if (description && isArray(description)) {
      schema.description = description.join(' ')
    }
    // Remove all keywords that aren't valid JSON keywords.
    const validator = this.getValidator()
    for (const key of Object.keys(schema)) {
      if (!validator.isKeyword(key)) {
        delete schema[key]
      }
    }
    return schema
  }

  // JSON types, used to determine when to use `$ref` instead of `type`.
  static jsonTypes = {
    string: true,
    number: true,
    integer: true,
    boolean: true,
    object: true,
    array: true
  }
}
