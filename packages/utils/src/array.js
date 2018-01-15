import { isArray } from './object'

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
