import { computed, shallowRef } from 'vue'
import { isFunction } from '@ditojs/utils'
import { getValueOrDefault } from '../utils/schema/data.js'
import type { SchemaContext, SchemaContextProps } from './useSchemaContext.ts'

export function useValue(
  props: SchemaContextProps,
  { createContext, services }: Omit<SchemaContext, 'context'>
) {
  // The last value that was written, after `parse()`:
  const parsedValue = shallowRef<any>(undefined)
  const value = computed<any>({
    get() {
      const { schema, data } = props
      const { name, format } = schema
      const value = getValueOrDefault(schema, data, name, () =>
        createContext({ value: data[name] })
      )
      // Some types use `format` for other things, like the color format:
      return isFunction(format) ? format(createContext({ value })) : value
    },

    set(value) {
      const { schema, data } = props
      const { parse } = schema
      if (parse) {
        value = parse(createContext({ value }))
      }
      parsedValue.value = value
      services.dataContext!.model.set(data, schema.name, value)
    }
  })
  return { value, parsedValue }
}

export type Value = ReturnType<typeof useValue>
