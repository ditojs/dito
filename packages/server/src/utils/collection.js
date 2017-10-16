import { isAsync } from './object'

export function mapValues(obj, fn) {
  return Object.entries(obj).reduce(function (newObj, [key, value]) {
    newObj[key] = fn(value, key)
    return newObj
  }, {})
}

export function pickKeys(obj, keys) {
  return keys.reduce((picked, key) => {
    if (key in obj) {
      picked[key] = obj[key]
    }
    return picked
  }, {})
}

export function groupItems(items, properties, process) {
  properties = Array.isArray(properties) ? properties : [properties]
  const grouping = items.reduce((groups, item) => {
    const values = properties.map(p => item[p])
    const key = values.map(v => JSON.stringify(v)).join(',')
    const group = groups[key] = groups[key] || { values: [], items: [] }
    group.values = values
    group.items.push(item)
    return groups
  }, {})
  const groups = Object.values(grouping)
  if (process) {
    const iter = ({ values, items }) => process(...values, items)
    return isAsync(process) ? Promise.map(groups, iter) : groups.map(iter)
  }
  return groups.map(({ items }) => items)
}
