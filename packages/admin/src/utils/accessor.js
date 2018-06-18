export function getSchemaAccessor(name, { type, get, set } = {}) {
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
          : this.getSchemaValue(name, { type })
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
