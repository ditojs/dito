import { isFunction } from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { computeValue } from '../utils/schema/data.js'

export default {
  computed: {
    value: {
      get() {
        const value = computeValue(
          this.schema,
          this.data,
          this.name,
          this.dataPath,
          { component: this }
        )
        // Only call `format()` if it's a function, as some types use `format`
        // for other purposes, e.g. `DitoTypeColor` for the color format.
        const { format } = this.schema
        return isFunction(format)
          ? format(new DitoContext(this, { value }))
          : value
      },

      set(value) {
        const { parse } = this.schema
        if (parse) {
          value = parse(new DitoContext(this, { value }))
        }
        this.parsedValue = value
        this.data[this.name] = value
      }
    }
  }
}
