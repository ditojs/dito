import objection from 'objection'
import validator from './validator'

export default class Model extends objection.Model {
  static get tableName() {
    // Simple convention: Use the constructor name as the tableName
    return this.name
  }

  static createValidator() {
    return validator
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
}
