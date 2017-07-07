export function isObject(val) {
  return val != null && typeof val === 'object' && Array.isArray(val) === false
}

export function isFunction(val) {
  return typeof val === 'function'
}

export function clone(obj) {
  return obj != null ? JSON.parse(JSON.stringify(obj)) : null
}
