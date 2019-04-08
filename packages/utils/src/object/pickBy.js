import { getCallback } from './getCallback'

export function pickBy(object, iteratee) {
  const callback = getCallback(iteratee)
  return Object.entries(object).reduce((result, [key, value]) => {
    if (callback(value, key, object)) {
      result[key] = value
    }
    return result
  }, {})
}
