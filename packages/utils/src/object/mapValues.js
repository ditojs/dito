import { getCallback } from './getCallback'

export function mapValues(object, iteratee) {
  const callback = getCallback(iteratee)
  return Object.keys(object).reduce((mapped, key) => {
    mapped[key] = callback(object[key], key, object)
    return mapped
  }, {})
}
