import { isString } from '../base/index.js'

export function asCallback(callback) {
  if (isString(callback)) {
    const key = callback
    return value => value[key]
  }
  return callback
}
