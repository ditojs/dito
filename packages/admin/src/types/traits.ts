import {
  isArray,
  isFunction,
  isObject,
  isString,
  pickBy
} from '@ditojs/utils'
import { tinycolor } from 'vue-color'
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
  getEmptyValue,
  getMultipleValue,
  getSchemaValue
} from '../utils/schema/data.js'
import { getItemProperty } from '../utils/schema/properties.js'
import { createReference } from '../utils/data.js'
import { getOptionKey, getRelateKey } from '../utils/schema/options.ts'

// Nested sections and panels hold their data in an object, others have no own
// value:
export const nestableTraits = {
  defaultValue: ({ schema }: Context) => (schema.nested ? {} : undefined),
  ignoresMissingValue: ({ schema }: Context) => (
    !schema.nested && !('default' in schema)
  ),
  // Unlike for `object` types, `null` doesn't mean there's no object:
  treatsNullAsMissing: ({ schema }: Context) => !!schema.nested,
  defaultNested: false,
  // Only nested ones have a property, the others share the data of their form:
  getProperty: (schema: Schema, context: Context) => (
    getItemProperty(context.schema, context) ?? { type: 'object' }
  )
}

export const sourceTraits = {
  defaultValue: ({ schema }: Context) => (isListSource(schema) ? [] : null),
  // Lists are never `null`, but `null` means there's no object:
  treatsNullAsMissing: ({ schema }: Context) => isListSource(schema),
  // Exclude all sources that have their own resource handling the data.
  defaultExclude: ({ schema }: Context) => !!schema.resource,

  // The items of sources with their own resource aren't part of the data,
  // also when a callback returns the resource:
  getProperty(schema: Schema, context: Context) {
    if (context.schema.resource) {
      return null
    } else {
      const item = getItemProperty(context.schema, context)
      return isListSource(schema)
        ? { type: 'array', ...(item && { items: item }) }
        : (item ?? { type: 'object' })
    }
  },

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

  async setupSchema({ schema, api, name }) {
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
  defaultValue: (context: Context) =>
    getMultipleValue(context.schema, context) ? [] : null,
  // Multiple values are never `null`:
  treatsNullAsMissing: (context: Context) =>
    getMultipleValue(context.schema, context),
  getOptionsDataSchema: schema => schema.options,

  // Related values are objects. Static options give the type of the values,
  // and their `enum`:
  getProperty(schema: Schema, context: Context) {
    const { options } = schema
    const { data, value } = isArray(options)
      ? { data: options }
      : (options ?? {})
    // Searches, tags and `equals` let other values in, also as callbacks, which
    // `schema` lacks:
    const { search, taggable } = context.schema
    const hasOtherValues = !!(search || taggable || options?.equals)
    let property = {}
    if (getRelateKey(schema)) {
      property = { type: 'object' }
    } else if (isArray(data) && !isFunction(value)) {
      const key = value ?? getOptionKey(data, false, 'value')
      const values = (key ? data.map(option => option[key]) : data).filter(
        value => value != null
      )
      const types = new Set(values.map(value => typeof value))
      if (types.size === 1) {
        const [type] = types
        property =
          type === 'object' || hasOtherValues
            ? { type }
            : { type, enum: values }
      }
    }
    return getMultipleValue(schema, context)
      ? { type: 'array', items: property }
      : property
  },

  serializeValue({ schema, value }: Context) {
    const relateKey = getRelateKey(schema)
    return relateKey ? createReference(value, relateKey) : value
  }
} satisfies Partial<TypeDescriptor>

export const numberTraits = {
  // The limits as written, without rounding them for integers:
  getProperty: ({ type, minimum, maximum, range, decimals }: Schema) => ({
    type: type === 'integer' ? 'integer' : 'number',
    ...pickBy({ minimum, maximum, range, decimals }, value => value != null)
  }),

  // Number inputs edit strings, and an empty one means no value:
  parseValue({ value }: Context) {
    return value === '' ? null : isString(value) ? Number(value) : value
  },

  getValidations(context: Context) {
    const { schema } = context
    const { minimum, maximum, step, decimals } = getNumberSettings(
      schema,
      context
    )
    const validations: Record<string, any> = {}
    if (minimum != null && maximum != null) {
      validations.range = [minimum, maximum]
    } else {
      if (minimum != null) {
        validations.minimum = minimum
      }
      if (maximum != null) {
        validations.maximum = maximum
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
  minimum: number | undefined
  maximum: number | undefined
  step: number | undefined
  decimals: number | undefined
  range: [number, number] | undefined
}

// The limits default to `range`, integers round them and `step` outwards.
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
  const minimum = round(getNumber('minimum') ?? range?.[0], Math.floor)
  const maximum = round(getNumber('maximum') ?? range?.[1], Math.ceil)
  return {
    minimum,
    maximum,
    step: round(getNumber('step'), Math.ceil),
    decimals: getNumber('decimals'),
    range: minimum != null && maximum != null ? [minimum, maximum] : undefined
  }
}

// Colors are stored in the format of `colorFormat`:
export const colorTraits = {
  // The server's colors are hex strings, the other formats are objects:
  getProperty: ({ colorFormat = 'hex' }: Schema) => ({
    type: colorFormat.startsWith('hex') ? 'color' : 'object'
  }),

  parseValue(context: Context) {
    const { schema, value } = context
    return value
      ? toTinyColorFormat(
          tinycolor(value),
          getSchemaValue('colorFormat', {
            type: String,
            schema,
            context,
            default: 'hex'
          })
        )
      : value
  }
} satisfies Partial<TypeDescriptor>

export const textTraits = {
  getProperty: () => ({ type: 'string' }),

  serializeValue(context: Context) {
    let { schema, value } = context
    if (schema.trim && value != null && isString(value)) {
      // Text fields don't necessarily have a `String` value when
      // `formatValue()` without `parseValue()` is used.
      value = value.trim()
    }
    if (value === '') {
      value = getEmptyValue(schema, context)
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

// tinycolor only has the string equivalent of this:
function toTinyColorFormat(color: any, format: string) {
  switch (format) {
    case 'rgb':
      return color.toRgb()
    case 'prgb':
      return color.toPercentageRgb()
    case 'hsl':
      return color.toHsl()
    case 'hsv':
      return color.toHsv()
    case 'hex3':
      return `#${color.toHex(true)}`
    case 'hex4':
      return `#${color.toHex8(true)}`
    case 'hex8':
      return `#${color.toHex8()}`
    case 'hex':
    case 'hex6':
    default:
      return color.getAlpha() < 1
        ? `#${color.toHex8()}`
        : `#${color.toHex()}`
  }
}
