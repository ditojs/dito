import { getItemParams } from '@/utils/data'
import { isFunction } from '@ditojs/utils'

export function getSchemaAccessor(name, { type, default: def, get, set } = {}) {
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
          : this.getSchemaValue(name, { type, default: def })
        : undefined
      return get ? get.call(this, value) : value
    },

    set(value) {
      if (set) {
        set.call(this, value)
      } else {
        this.overrides = this.overrides || {}
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
        value = isFunction(def) ? def.call(this, getItemParams(this)) : def
        // Trigger setter by setting value and accessor to default:
        this[name] = value
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
