import { isObject, isArray } from '@ditojs/utils'

export function asArguments(val) {
  return isArray(val) ? val : val != null ? [val] : []
}

export function mapValues(obj, callback) {
  return Object.entries(obj).reduce((res, [key, value]) => {
    res[key] = callback(value, key)
    return res
  }, {})
}

function deepMergeWithDirection(unshift, target, sources) {
  if (target && sources.length) {
    for (const source of sources) {
      if (isObject(source) && isObject(target)) {
        let before = null
        if (unshift) {
          before = target
          target = {}
        }
        for (const key in source) {
          const value = source[key]
          target[key] = deepMerge(
            before?.[key] || target[key] || (
              isArray(value) && [] ||
              isObject(value) && {}
            ), value) || value
        }
        if (unshift) {
          // "unshift" the added fields by inserting the fields that were there
          // before in a new target at the end.
          for (const key in before) {
            if (!(key in target)) {
              target[key] = before[key]
            }
          }
        }
      } else if (isArray(source) && isArray(target)) {
        const dest = unshift ? [] : target
        for (const value of source) {
          if (!target.includes(value)) {
            dest.push(value)
          }
        }
        if (unshift) {
          target.unshift(...dest)
        }
      } else if (typeof source === typeof target) {
        // The source overrides the target
        target = source
      }
    }
  }
  return target
}

export function deepMerge(target, ...sources) {
  return deepMergeWithDirection(false, target, sources)
}

export function deepMergeUnshift(target, ...sources) {
  return deepMergeWithDirection(true, target, sources)
}
