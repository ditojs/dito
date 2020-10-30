const uidMap = new WeakMap()

// Generated and remembers unique ids per passed object using a weak map.
let uid = 0
export function getUid(object, itemId) {
  let id = uidMap.get(object)
  if (!id) {
    id = id = itemId || `@${++uid}`
    uidMap.set(object, id)
  }
  return id
}
