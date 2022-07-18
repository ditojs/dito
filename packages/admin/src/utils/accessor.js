import {
  isFunction, isString, parseDataPath, normalizeDataPath
} from '@ditojs/utils'

export function getSchemaAccessor(
  keyOrDataPath,
  { type, default: def, get, set, callback = true } = {}
) {
  // `keyOrDataPath` can be a simple property key,
  // or a data-path into sub-properties, both in array or string format.
  if (isString(keyOrDataPath) && keyOrDataPath.includes('.')) {
    keyOrDataPath = parseDataPath(keyOrDataPath)
  }
  // Use the normalized data path for the handling overrides
  const name = normalizeDataPath(keyOrDataPath)
  return {
    get() {
      // Only determine schema value if we have no getter, or the getter
      // wants to receive the value and process it further:
      const value = !get || get.length > 0
        // NOTE: Because `schema` objects are retrieved from `meta` object, they
        // don't seem to be reactive. To allow changed in `schema` values,
        // `set()` stores changed values in the separate `overrides` object.
        ? this.overrides && name in this.overrides
          ? this.overrides[name]
          : this.getSchemaValue(keyOrDataPath, { type, default: def, callback })
        : undefined
      return get ? get.call(this, value) : value
    },

    set(value) {
      if (set) {
        set.call(this, value)
      } else {
        this.overrides ||= {}
        this.$set(this.overrides, name, value)
      }
    }
  }
}

export function getStoreAccessor(name, { default: def, get, set } = {}) {
  return {
    get() {
      let value = this.getStore(name)
      if (value === undefined && def !== undefined) {
        // Support `default()` functions:
        value = isFunction(def) ? def.call(this, this.context) : def
        // Trigger setter by setting value and accessor to default:
        this[name] = value
        // Now access store again, for reactivity tracking
        this.getStore(name)
      }
      // Allow the provided getter to further change or process the value
      // retrieved from the store:
      return get ? get.call(this, value) : value
    },

    set(value) {
      // Allow the provided setter to return a new value to set, or do the
      // setting itself, and then return `undefined`:
      if (!set || (value = set.call(this, value)) !== undefined) {
        this.setStore(name, value)
      }
    }
  }
}
