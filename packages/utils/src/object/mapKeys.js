import { getCallback } from './getCallback'

export function mapKeys(object, iteratee) {
  const callback = getCallback(iteratee)
  return Object.keys(object).reduce((mapped, key) => {
    const value = object[key]
    mapped[callback(value, key, object)] = value
    return mapped
  }, {})
}
