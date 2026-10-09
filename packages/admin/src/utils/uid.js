import { toRaw } from 'vue'
import { isArray, isPlainObject, isString } from '@ditojs/utils'
import { isTemporaryId } from './data.js'

const uidsByItem = new WeakMap()

// Generated uids have their own prefix, so that they can't be mistaken for
// temporary ids, see `setTemporaryId()`.
const generatedUidPrefix = 'uid-'
let lastGeneratedUid = 0

// Generates and remembers unique ids per passed object using a weak map.
export function getUid(item, getItemId = null) {
  const raw = toRaw(item)
  let uid = uidsByItem.get(raw)
  if (!uid && item) {
    uid = getItemId?.(item) || `${generatedUidPrefix}${++lastGeneratedUid}`
    uidsByItem.set(raw, uid)
  }
  return uid
}

// Transfers the uids of new objects in `source`, which are generated or
// temporary ids, to the objects at the same places in `target` that don't have
// uids yet, e.g. when the saved data replaces the data that was edited. This
// way, the components and stores that are keyed by the uids of new items are
// kept, even though the items only have their ids once they are saved.
export function transferUids(source, target) {
  const rawSource = toRaw(source)
  const rawTarget = toRaw(target)
  if (
    rawSource !== rawTarget &&
    isTransferable(rawSource) &&
    isTransferable(rawTarget)
  ) {
    const uid = uidsByItem.get(rawSource)
    if (isNewItemUid(uid) && !uidsByItem.has(rawTarget)) {
      uidsByItem.set(rawTarget, uid)
    }
    for (const key of Object.keys(rawSource)) {
      if (key in rawTarget) {
        transferUids(rawSource[key], rawTarget[key])
      }
    }
  }
}

function isTransferable(value) {
  return isArray(value) || isPlainObject(value)
}

function isNewItemUid(uid) {
  return (
    isString(uid) &&
    (uid.startsWith(generatedUidPrefix) || isTemporaryId(uid))
  )
}
