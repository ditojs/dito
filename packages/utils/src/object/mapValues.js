
export function mapValues(object, callback) {
  return Object.keys(object).reduce((mapped, key) => {
    mapped[key] = callback(object[key], key, object)
    return mapped
  }, {})
}
