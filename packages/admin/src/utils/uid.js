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
// temporary ids, to the corresponding objects in `target` that don't have uids
// yet, e.g. when the saved data replaces the data that was edited. This way,
// the components and stores that are keyed by the uids of new items are kept,
// even though the items only have their ids once they are saved.
// Objects are matched by their keys. Array items are matched by their ids, as
// returned by `getItemId()`, see `transferArrayUids()`.
export function transferUids(source, target, getItemId = getDefaultItemId) {
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
    if (isArray(rawSource) && isArray(rawTarget)) {
      transferArrayUids(rawSource, rawTarget, getItemId)
    } else {
      for (const key of Object.keys(rawSource)) {
        if (key in rawTarget) {
          transferUids(rawSource[key], rawTarget[key], getItemId)
        }
      }
    }
  }
}

// Matches the items of two arrays by their ids rather than their positions, as
// the saved items may be ordered differently than the edited ones: Each saved
// item in `source` is matched with the item in `target` that has the same id.
// The new items in `source`, which have no id or a temporary one, can only be
// matched with the items in `target` that have none of the saved ids, in order,
// and only if their counts are equal. Otherwise, they are left unmatched rather
// than risking to give an item the uid, component and store of another.
function transferArrayUids(source, target, getItemId) {
  const sourceItems = source.filter(isTransferable)
  const targetItems = target.filter(isTransferable)
  const targetItemsById = new Map()
  for (const item of targetItems) {
    const id = getSavedItemId(item, getItemId)
    if (id !== undefined) {
      targetItemsById.set(id, item)
    }
  }
  const savedIds = new Set()
  const newSourceItems = []
  for (const item of sourceItems) {
    const id = getSavedItemId(item, getItemId)
    if (id !== undefined) {
      savedIds.add(id)
      const targetItem = targetItemsById.get(id)
      if (targetItem) {
        transferUids(item, targetItem, getItemId)
      }
    } else {
      newSourceItems.push(item)
    }
  }
  const newTargetItems = targetItems.filter(
    item => !savedIds.has(getSavedItemId(item, getItemId))
  )
  if (newSourceItems.length === newTargetItems.length) {
    newSourceItems.forEach((item, index) => {
      transferUids(item, newTargetItems[index], getItemId)
    })
  }
}

function getDefaultItemId(item) {
  return item.id
}

// Returns the id of a saved item as a string, so that numeric ids match their
// string representations, or `undefined` for new items.
function getSavedItemId(item, getItemId) {
  const id = getItemId(item)
  return id != null && !isTemporaryId(id) ? String(id) : undefined
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
