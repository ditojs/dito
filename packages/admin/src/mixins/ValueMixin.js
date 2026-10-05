import { isFunction } from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { getValueOrDefault } from '../utils/schema/data.js'

export default {
  computed: {
    value: {
      get() {
        // `DataModel` writes computed values into the data, see
        // `computeValue()`.
        const value = getValueOrDefault(
          this.schema,
          this.data,
          this.name,
          () =>
            DitoContext.createForSchema(this, {
              schema: this.schema,
              name: this.name,
              data: this.data,
              dataPath: this.dataPath,
              rootData: this.rootData
            })
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
