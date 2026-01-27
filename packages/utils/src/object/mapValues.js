import { asCallback } from './asCallback.js'

export function mapValues(object, callback) {
  callback = asCallback(callback)
  return Object.keys(object).reduce((mapped, key) => {
    mapped[key] = callback(object[key], key, object)
    return mapped
  }, {})
}
