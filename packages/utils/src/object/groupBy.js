import { isArray } from '@/base'
import { getCallback } from './getCallback'

export function groupBy(collection, iteratee) {
  const callback = getCallback(iteratee)
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
