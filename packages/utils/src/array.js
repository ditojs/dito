import { isArray } from './base'

export function flatten(array) {
  return array.reduce((res, entry) => {
    if (isArray(entry)) {
      res.push(...flatten(entry))
    } else {
      res.push(entry)
    }
    return res
  }, [])
}
