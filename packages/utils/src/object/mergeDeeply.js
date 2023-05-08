import { isArray, isPlainObject } from '../base/index.js'
import { deprecate } from '../function/deprecate.js'
import { clone } from './clone.js'

export function mergeDeeply(target, ...sources) {
  for (const source of sources) {
    target = mergeValues(target, source, true, true)
  }
  return target
}

export function merge(...args) {
  deprecate(
    'merge() is deprecated, use assignDeeply() or mergeDeeply() instead.'
  )
  return mergeDeeply(...args)
}

export function assignDeeply(target, ...sources) {
  for (const source of sources) {
    target = mergeValues(target, source, true, false)
  }
  return target
}

function mergeValues(target, source, root, concat) {
  if (target && source && target !== source) {
    if (isArray(target) && isArray(source)) {
      return mergeIteratively(target, source, root, concat, true)
    } else if (isPlainObject(target) && isPlainObject(source)) {
      return mergeIteratively(target, source, root, concat, false)
    }
  }
  return root ? source ?? target : source
}

function mergeIteratively(target, source, root, concat, toArray) {
  const result = root
    ? target
    : clone(target, { shallow: true })
  for (const key of Object.keys(source)) {
    const to = target[key]
    const from = source[key]
    const value = mergeValues(to, from, false, concat)
    if (value === from && toArray && concat) {
      // Append non-mergeable values to the end of results array.
      result.push(value)
    } else {
      result[key] = value
    }
  }
  return result
}
