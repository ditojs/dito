import { computed, shallowRef } from 'vue'
import { getRootData } from '../utils/services.ts'
import { hasNestedData } from '../utils/schema/structure.js'
import { getFieldPropertyNode } from '../utils/schema/properties.js'
import { getEditedValue, parseEditedValue } from '../utils/schema/data.js'
import type {
  SchemaContextSetup,
  SchemaContextProps
} from './useSchemaContext.ts'

export function useValue(
  props: SchemaContextProps,
  { createContext, services }: Omit<SchemaContextSetup, 'context'>
) {
  const getValueOrDefault = () => {
    const { schema, data, dataPath, itemDataPath } = props
    const { name } = schema
    const entry = {
      data,
      name,
      dataPath,
      itemDataPath,
      rootData: getRootData(services),
      services
    }
    return getFieldPropertyNode(schema, name, entry)?.getValueOrDefault(entry)
  }
  // The last value that was written, after `parseValue()`:
  const parsedValue = shallowRef<any>(undefined)
  const value = computed<any>({
    get() {
      const { schema, data } = props
      const { name } = schema
      // Like the nodes of fields, show the values that are there, also `null`,
      // and the default of the field's property for missing ones. Unnested
      // components hold no value of their own:
      const value =
        name in data || !hasNestedData(schema)
          ? data[name]
          : getValueOrDefault()
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
