import { computed, shallowRef } from 'vue'
import {
  getValueOrDefault,
  getEditedValue,
  parseEditedValue
} from '../utils/schema/data.js'
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
      const { name } = schema
      const value = getValueOrDefault(schema, data, name, () =>
        createContext({ value: data[name] })
      )
      return getEditedValue(schema, value, () => createContext({ value }))
    },

    set(value) {
      const { schema, data, dataPath } = props
      value = parseEditedValue(schema, value, value => createContext({ value }))
      parsedValue.value = value
      services.dataContext!.model.set(
        { data, name: schema.name, dataPath },
        value
      )
    }
  })
  return { value, parsedValue }
}

export type Value = ReturnType<typeof useValue>
