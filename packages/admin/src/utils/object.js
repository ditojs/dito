export function clone(obj) {
  return obj != null ? JSON.parse(JSON.stringify(obj)) : null
}
