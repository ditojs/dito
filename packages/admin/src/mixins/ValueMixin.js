import DitoContext from '../DitoContext.js'
import { computeValue } from '../utils/schema.js'

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
        const { format } = this.schema
        return format
          ? format(new DitoContext(this, { value }))
          : value
      },

      set(value) {
        const { parse } = this.schema
        if (parse) {
          value = parse(new DitoContext(this, { value }))
        }
        this.parsedValue = value
        // eslint-disable-next-line vue/no-mutating-props
        this.data[this.name] = value
      }
    }
  }
}
