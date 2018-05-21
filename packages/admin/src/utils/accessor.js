export function getSchemaAccessor(name, get, set) {
  return {
    get() {
      // NOTE: Because `schema` objects are retrieved from `meta` object, they
      // aren't reactive. To allow changed in `schema` values, `set()` stores
      // changed values in the separate `overrides` object.
      return this.overrides && name in this.overrides
        ? this.overrides[name]
        : get ? get.call(this) : this.schema[name]
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
