import { asCallback } from './asCallback.js'

export function pickBy(object, callback) {
  callback = asCallback(callback)
  return Object.entries(object).reduce((result, [key, value]) => {
    if (callback(value, key, object)) {
      result[key] = value
    }
    return result
  }, {})
}
