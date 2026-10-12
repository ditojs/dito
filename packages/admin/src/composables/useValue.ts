import { computed, shallowRef } from 'vue'
import { getValueOrDefault } from '../utils/schema/data.js'
import type {
  SchemaContextSetup,
  SchemaContextProps
} from './useSchemaContext.ts'

export function useValue(
  props: SchemaContextProps,
  { createContext, services }: Omit<SchemaContextSetup, 'context'>
) {
  // The last value that was written, after `parseValue()`:
  const parsedValue = shallowRef<any>(undefined)
  const value = computed<any>({
    get() {
      const { schema, data } = props
      const { name, formatValue } = schema
      const value = getValueOrDefault(schema, data, name, () =>
        createContext({ value: data[name] })
      )
      return formatValue ? formatValue(createContext({ value })) : value
    },

    set(value) {
      const { schema, data } = props
      const { parseValue } = schema
      if (parseValue) {
        value = parseValue(createContext({ value }))
      }
      parsedValue.value = value
      services.dataContext!.model.set(data, schema.name, value)
    }
  })
  return { value, parsedValue }
}

export type Value = ReturnType<typeof useValue>
