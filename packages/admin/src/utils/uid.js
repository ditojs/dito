import { toRaw } from 'vue'
import { isArray, isPlainObject, clone } from '@ditojs/utils'

const uidsByItem = new WeakMap()
const originalsByCopy = new WeakMap()

// Generated uids can't be mistaken for temporary ids with their own prefix:
const generatedUidPrefix = 'uid-'
let lastGeneratedUid = 0

export function getUid(item, getItemId = null) {
  const raw = toRaw(item)
  let uid = uidsByItem.get(raw)
  if (!uid && item) {
    const original = originalsByCopy.get(raw)
    uid = original
      ? getUid(original, getItemId)
      : getItemId?.(item) || `${generatedUidPrefix}${++lastGeneratedUid}`
    uidsByItem.set(raw, uid)
  }
  return uid
}

// Copies share the uids of their originals, e.g. drafts of nested forms, so the
// components and stores keyed by them stay attached, and they merge back.
export function cloneWithUids(value, options) {
  const copy = clone(value, options)
  const link = (original, copy) => {
    if (
      // Values that `options.transferables` share aren't copies...
      copy !== original &&
      (isPlainObject(copy) || isArray(copy)) &&
      // ...and copies that hold their ancestors are linked already:
      !originalsByCopy.has(copy)
    ) {
      originalsByCopy.set(copy, toRaw(original))
      for (const [key, value] of Object.entries(copy)) {
        link(original[key], value)
      }
    }
  }
  link(value, copy)
  return copy
}

export function getOriginal(copy) {
  return originalsByCopy.get(toRaw(copy)) ?? null
}
