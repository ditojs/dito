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
  getDefaultValue,
  getMultipleValue,
  getSchemaValue
} from '../utils/schema/data.js'
import { getItemProperty } from '../utils/schema/properties.js'
import {
  findOptionForValue,
  getOptionKey,
  getOptionsSettings,
  getRelateKey,
  getValueForOption
} from '../utils/schema/options.ts'

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
  getProperty: (schema: Schema, context: Context, field: Schema) => (
    getItemProperty(field, context) ?? { type: 'object' }
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
  getProperty(schema: Schema, context: Context, field: Schema) {
    if (field.resource) {
      return null
    } else {
      const item = getItemProperty(field, context)
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

  // Values need to be among static options. Loaded options can miss values
  // while they change, and tags and searches add values of their own:
  getValidations(context: Context) {
    const { schema } = context
    const { options } = schema
    const staticOptions = isArray(options) ? options : options?.data
    if (
      isArray(staticOptions) &&
      !schema.search &&
      !getSchemaValue('taggable', { type: [Boolean, Object], schema, context })
    ) {
      const multiple = getMultipleValue(schema, context)
      const settings = getOptionsSettings(schema, staticOptions, {
        multiple,
        isGrouped: false,
        createContext: values =>
          context.extend({ options: staticOptions, ...values })
      })
      const isOption = (value: any) => (
        findOptionForValue(
          settings,
          staticOptions,
          settings.relateKey ? getValueForOption(settings, value) : value
        ) !== undefined
      )
      return {
        enum: (value: any) =>
          multiple && isArray(value) ? value.every(isOption) : isOption(value)
      }
    } else {
      return {}
    }
  },

  // Related values are objects. Static options give the type of the values,
  // and their `enum`:
  getProperty(schema: Schema, context: Context, field: Schema) {
    const { options } = schema
    const { data, value } = isArray(options)
      ? { data: options }
      : (options ?? {})
    // Searches, tags and `equals` let other values in, also as callbacks, which
    // `schema` lacks:
    const hasOtherValues = !!(
      field.search ||
      field.taggable ||
      field.options?.equals
    )
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
  renamedSchemaKeys: ['minimum', 'maximum'],
  // The limits as written, without rounding them for integers:
  getProperty: ({ type, minimum, maximum, range }: Schema) => ({
    type: type === 'integer' ? 'integer' : 'number',
    ...pickBy({ minimum, maximum, range }, value => value != null)
  }),

  // Number inputs edit strings, and an empty one means no value:
  parseValue({ schema, value }: Context) {
    return value === ''
      ? null
      : isString(value)
        ? schema.type === 'integer'
          ? Number(value)
          : parseFloat(`${value}`)
        : value
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

// Colors are stored in the color format of `format`:
export const colorTraits = {
  // The server's colors are hex strings, the other formats are objects:
  getProperty: ({ format = 'hex' }: Schema) => ({
    type: format.startsWith('hex') ? 'color' : 'object'
  }),

  parseValue(context: Context) {
    const { schema, value } = context
    return value
      ? toTinyColorFormat(
          tinycolor(value),
          getSchemaValue('format', {
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
