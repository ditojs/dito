
export function mapKeys(object, callback) {
  return Object.keys(object).reduce((mapped, key) => {
    const value = object[key]
    mapped[callback(key, value, object)] = value
    return mapped
  }, {})
}
