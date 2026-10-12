import { computed, shallowRef } from 'vue'
import { isFunction } from '@ditojs/utils'
import { getValueOrDefault } from '../utils/schema/data.js'
import type { SchemaContext, SchemaContextProps } from './useSchemaContext.ts'

// The value at `schema.name` in `data`, which writes through the data model of
// the container.
export function useValue(
  props: SchemaContextProps,
  { createContext, services }: Omit<SchemaContext, 'context'>
) {
  // The last value that was written, after `parse()`:
  const parsedValue = shallowRef<any>(undefined)
  // The value that the component displays and edits, through `format()` and
  // `parse()` of the schema:
  const value = computed<any>({
    get() {
      const { schema, data } = props
      const { name, format } = schema
      // `DataModel` writes computed values into the data, see
      // `computeValue()`.
      const value = getValueOrDefault(schema, data, name, () =>
        createContext({ value: data[name] })
      )
      // Only call `format()` if it's a function, as some types use `format`
      // for other purposes, e.g. `DitoTypeColor` for the color format.
      return isFunction(format) ? format(createContext({ value })) : value
    },

    set(value) {
      const { schema, data } = props
      const { parse } = schema
      if (parse) {
        value = parse(createContext({ value }))
      }
      parsedValue.value = value
      services.container!.model.set(data, schema.name, value)
    }
  })
  return { value, parsedValue }
}

export type Value = ReturnType<typeof useValue>
