import { isArray } from '../base/index.js'

export function groupBy(collection, callback) {
  const array = isArray(collection)
    ? collection
    : Object.values(collection)
  return array.reduce((groups, item) => {
    const key = callback(item)
    const group = groups[key] || (groups[key] = [])
    group.push(item)
    return groups
  }, {})
}
