import { toModelData } from '../data.js'
import { isMatchingType, convertType } from '../type.js'
import {
  isArray,
  isFunction,
  asArray,
  clone,
  labelize,
  getValueAtDataPath
} from '@ditojs/utils'
import { getTypeDescriptor, getSourceType } from './types.ts'
import {
  someNestedSchemaComponent,
  hasNestedSchemaComponents,
  isPanelWithOwnData
} from './structure.js'

export function getSchemaValue(
  keyOrDataPath,
  { type, schema, callback = true, default: def, context } = {}
) {
  const types = type && asArray(type)
  // For performance reasons, data paths are only supported as arrays:
  let value = schema
    ? isArray(keyOrDataPath)
      ? getValueAtDataPath(schema, keyOrDataPath, () => undefined)
      : schema[keyOrDataPath]
    : undefined

  if (value === undefined && def !== undefined) {
    if (callback && isFunction(def) && !isMatchingType(types, def)) {
      // Support `default()` functions for any type except `Function`:
      def = def(context)
    }
    return def
  }

  if (isMatchingType(types, value)) {
    return value
  }
  // Any schema value can be a function, resolved when the value is evaluated:
  if (callback && isFunction(value)) {
    value = value(context)
  }
  // See if we can convert to the expected types:
  if (types && value != null && !isMatchingType(types, value)) {
    for (const type of types) {
      const converted = convertType(type, value)
      if (converted !== value) {
        return converted
      }
    }
  }
  return value
}

// Labels are text, `html`, or `{ text, prefix, suffix }` objects, which the
// renderers display as they are:
export function getLabel(schema, context, name) {
  return schema
    ? getSchemaValue('label', { schema, context, type: [String, Object] }) ||
      labelize(name || schema.name)
    : labelize(name) || ''
}

export function shouldRenderSchema(schema, context) {
  return (
    getSchemaValue('if', {
      type: Boolean,
      schema,
      context,
      default: true
    }) && (
      // Panels with their own data evaluate their components in it:
      isPanelWithOwnData(schema) ||
      shouldRenderComponents(schema, context)
    )
  )
}

export function shouldRenderComponents(schema, context) {
  return (
    !hasNestedSchemaComponents(schema) ||
    // Sources render their components for each item, with its own context:
    !!getSourceType(schema) ||
    // Evaluate the components with their own contexts, like when rendered:
    someNestedSchemaComponent(schema, (component, name) =>
      shouldRenderSchema(component, context.createChildContext(component, name))
    )
  )
}

export function resolveValue(value, context) {
  return isFunction(value)
    ? toModelData(value(getContext(context)))
    : clone(value)
}

export function hasComputedValueSource(schema) {
  return !!schema.computeValue || hasValueFromDataSchema(schema)
}

export function hasValueFromDataSchema(schema) {
  return (
    !!getTypeDescriptor(schema)?.resolvesValue &&
    !!(schema.data || schema.dataPath)
  )
}

export function getMultipleValue(schema, context) {
  return getSchemaValue('multiple', {
    type: Boolean,
    schema,
    context,
    default: !!getTypeDescriptor(schema)?.defaultMultiple
  })
}

// The value as the component edits it, after `formatValue()`. The components
// compare values by identity, e.g. with options:
export function getEditedValue(schema, value, context) {
  const { formatValue } = schema
  return formatValue ? toModelData(formatValue(getContext(context))) : value
}

// The value to store for the edited value, after `parseValue()`:
export function parseEditedValue(schema, value, createContext) {
  return convertValue(schema, 'parseValue', value, createContext)
}

// Callbacks that fail are logged and count as `fallback`, e.g. a failing `if`
// as shown:
export function callOrLog(callback, fallback) {
  try {
    return callback()
  } catch (error) {
    console.error(error)
    return fallback
  }
}

function getContext(context) {
  return isFunction(context) ? context() : context
}

// Convert the value with the hook of its type first, then with the schema's:
function convertValue(schema, hookName, value, createContext) {
  for (const convert of [
    getTypeDescriptor(schema)?.[hookName],
    schema[hookName]
  ]) {
    if (convert) {
      value = convert(createContext(value))
    }
  }
  return value
}
