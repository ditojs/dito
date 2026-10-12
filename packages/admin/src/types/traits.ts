import { isArray, isObject, isString, normalizeDataPath } from '@ditojs/utils'
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

export const sourceTraits = {
  defaultValue: ({ schema }: Context) => (isListSource(schema) ? [] : null),
  // Exclude all sources that have their own resource handling the data.
  excludeValue: ({ schema }: Context) => !!schema.resource,

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

  async processSchema(api, schema, name) {
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

  processValue({ schema, value, dataPath }, graph) {
    graph.addSource(dataPath, schema)
    // `SchemaGraph.serialize()` changes item ids, and only the items of sources
    // with forms are copies already:
    return hasFormSchema(schema) ? value : copyItems(value)
  }
} satisfies Partial<TypeDescriptor>

export const optionsTraits = {
  getOptionsDataSchema: schema => schema.options,

  processValue({ schema, value, dataPath }: Context, graph) {
    if (schema.relate) {
      // Internally related data (`options.dataPath`) needs both the options
      // (for '#ref') and the value ('#id') processed:
      const path = schema.options?.dataPath
      const relatedDataPath = path
        ? normalizeDataPath(`${dataPath}/${path}`)
        : null
      graph.addRelation(dataPath, relatedDataPath, schema)
      // Convert relating objects to a shallow copy with only the id left.
      // TODO: Convert to using `relateBy`:
      const processRelate = (value: any) => (value ? { id: value.id } : value)
      // Selected options can be both objects & arrays, e.g. 'checkboxes':
      value =
        getMultipleValue(schema) && isArray(value)
          ? value.map(processRelate)
          : processRelate(value)
    }
    return value
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
  processValue(context: Context) {
    let { schema, value } = context
    if (schema.trim && value != null && isString(value)) {
      // Text fields don't necessarily have a `String` value when `format()`
      // without `parse()` is used.
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
