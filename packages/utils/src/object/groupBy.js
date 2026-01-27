import { isArray } from '../base/index.js'
import { asCallback } from './asCallback.js'

export function groupBy(collection, callback) {
  const array = isArray(collection)
    ? collection
    : Object.values(collection)
  callback = asCallback(callback)
  return array.reduce((groups, item) => {
    const key = callback(item)
    const group = groups[key] || (groups[key] = [])
    group.push(item)
    return groups
  }, {})
}
