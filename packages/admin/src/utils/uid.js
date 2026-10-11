import { toRaw } from 'vue'
import { isArray, isPlainObject, clone } from '@ditojs/utils'

const uidsByItem = new WeakMap()
const originalsByCopy = new WeakMap()

// Generated uids have their own prefix, so that they can't be mistaken for
// temporary ids, see `setTemporaryId()`.
const generatedUidPrefix = 'uid-'
let lastGeneratedUid = 0

// Generates and remembers unique ids per passed object using a weak map.
// Copies share the uids of their originals, see `cloneWithUids()`.
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

// Clones `value` deeply with `clone()`, into copies that remember their
// originals and share their uids, e.g. the draft of a nested form, so that the
// components and stores keyed by them stay attached, and the copies can be
// merged back by their uids.
export function cloneWithUids(value, options) {
  const copy = clone(value, options)
  const link = (original, copy) => {
    // Values that `options.transferables` share aren't copies:
    if (copy !== original && (isPlainObject(copy) || isArray(copy))) {
      originalsByCopy.set(copy, toRaw(original))
      for (const [key, value] of Object.entries(copy)) {
        link(original[key], value)
      }
    }
  }
  link(value, copy)
  return copy
}

// Returns the object that `copy` was cloned from by `cloneWithUids()`.
export function getOriginal(copy) {
  return originalsByCopy.get(toRaw(copy)) ?? null
}
