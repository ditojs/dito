import { isArray, isObject, isString } from '@ditojs/utils'
import type { Context, TypeDescriptor } from '../utils/schema/types.ts'
import type { Schema } from '../utils/types.ts'
import {
  isInlined,
  isListSource,
  isObjectSource
} from '../utils/schema/structure.js'
import { hasFormSchema } from '../utils/schema/lookup.js'
import { setupForms } from '../utils/schema/setup.js'
import {
  getDefaultValue,
  getMultipleValue,
  getSchemaValue
} from '../utils/schema/data.js'
import { getRelateKey } from '../utils/schema/options.ts'

export const sourceTraits = {
  defaultValue: ({ schema }: Context) => (isListSource(schema) ? [] : null),
  // Exclude all sources that have their own resource handling the data.
  defaultExclude: ({ schema }: Context) => !!schema.resource,

  // Wrap primitive values in objects under the key `wrapPrimitives`:
  getItemAdapter({ wrapPrimitives: name }) {
    return name
      ? {
          name,
          wrap: value => ({ [name]: value }),
          unwrap: item => item[name]
        }
      : null
  },

  async setupSchema(api, schema, name) {
    schema.name ??= name
    // Mutating forms edit the items in place, which primitives can't be:
    if (
      schema.wrapPrimitives &&
      schema.mutate &&
      hasFormSchema(schema) &&
      !isInlined(schema)
    ) {
      throw new Error(
        `Unsupported 'mutate' in lists with 'wrapPrimitives': '${
          schema.name
        }'.`
      )
    }
    if (isInlined(schema) && schema.resource) {
      throw new Error(
        `Nested ${
          isListSource(schema)
            ? 'lists'
            : isObjectSource(schema)
              ? 'objects'
              : 'schema'
        } cannot load data from their own resources`
      )
    }
    await setupForms(api, schema)
  },

  serializeValue({ schema, value }: Context) {
    // `SchemaGraph.serialize()` changes item ids, and only the items of sources
    // with forms are copies already:
    return hasFormSchema(schema) ? value : copyItems(value)
  }
} satisfies Partial<TypeDescriptor>

export const optionsTraits = {
  getOptionsDataSchema: schema => schema.options,

  serializeValue(context: Context) {
    const { schema, value } = context
    const relateKey = getRelateKey(schema)
    if (relateKey) {
      // Convert relating objects to a shallow copy with only the id left:
      const toRelate = (value: any) =>
        value ? { [relateKey]: value[relateKey] } : value
      // Selected options can be both objects & arrays, e.g. 'checkboxes':
      return getMultipleValue(schema, context) && isArray(value)
        ? value.map(toRelate)
        : toRelate(value)
    } else {
      return value
    }
  }
} satisfies Partial<TypeDescriptor>

export const numberTraits = {
  getValidations(schema, context) {
    const { min, max, step, decimals } = getNumberSettings(schema, context)
    const validations: Record<string, any> = {}
    if (min != null && max != null) {
      validations.range = [min, max]
    } else {
      if (min != null) {
        validations.min = min
      }
      if (max != null) {
        validations.max = max
      }
    }
    if (decimals != null) {
      validations.decimals = decimals
    } else if (step) {
      const stepDecimals = (`${step}`.split('.')[1] || '').length
      if (stepDecimals > 0) {
        validations.decimals = stepDecimals
      } else {
        validations.integer = true
      }
    }
    if (schema.type === 'integer') {
      validations.integer = true
    }
    return validations
  }
} satisfies Partial<TypeDescriptor>

export interface NumberSettings {
  min: number | undefined
  max: number | undefined
  step: number | undefined
  decimals: number | undefined
  range: [number, number] | undefined
}

// `min` and `max` default to `range`, integers round them and `step` outwards.
export function getNumberSettings(
  schema: Schema,
  context: Context
): NumberSettings {
  const isInteger = schema.type === 'integer'
  const getNumber = (key: string) =>
    getSchemaValue(key, { type: Number, schema, context })
  const round = (
    value: number | undefined,
    roundFunction: (value: number) => number
  ) => (isInteger && value != null ? roundFunction(value) : value)
  const range = getSchemaValue('range', { type: Array, schema, context })
  const min = round(getNumber('min') ?? range?.[0], Math.floor)
  const max = round(getNumber('max') ?? range?.[1], Math.ceil)
  return {
    min,
    max,
    step: round(getNumber('step'), Math.ceil),
    decimals: getNumber('decimals'),
    range: min != null && max != null ? [min, max] : undefined
  }
}

export const textTraits = {
  serializeValue(context: Context) {
    let { schema, value } = context
    if (schema.trim && value != null && isString(value)) {
      // Text fields don't necessarily have a `String` value when
      // `formatValue()` without `parseValue()` is used.
      value = value.trim()
    }
    if (value === '') {
      value = getDefaultValue(schema, context)
    }
    return value
  }
} satisfies Partial<TypeDescriptor>

function copyItems(value: any) {
  return isArray(value)
    ? value.map(item => (isObject(item) ? { ...item } : item))
    : isObject(value)
      ? { ...value }
      : value
}
