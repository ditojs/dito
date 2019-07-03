const uidMap = new WeakMap()

// Generated and remembers unique ids per passed object using a weak map.
let uid = 0
export function getUid(object) {
  let id = uidMap.get(object)
  if (!id) {
    uidMap.set(object, id = `@${++uid}`)
  }
  return id
};
