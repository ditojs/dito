import { toRaw } from 'vue'

const uidMap = new WeakMap()

// Generated and remembers unique ids per passed object using a weak map.
let uid = 0
export function getUid(item, getItemId = null) {
  const raw = toRaw(item)
  let id = uidMap.get(raw)
  if (!id && item) {
    id = getItemId?.(item) || `@${++uid}`
    uidMap.set(raw, id)
  }
  return id
}
