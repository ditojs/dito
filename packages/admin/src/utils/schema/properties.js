import { isFunction } from '@ditojs/utils'
import { getTypeDescriptor } from './types.ts'
import { iterateNestedSchemaComponents } from './structure.js'
import {
  getDefaultValue,
  getEmptyValue,
  shouldIgnoreMissingValue
} from './data.js'

// The keys of fields that are keywords of the server's properties:
const propertyKeys = [
  'minimum',
  'maximum',
  'range',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems'
]

// Describe the data of the form's fields as the `properties` of server models:
export function getFormProperties(schema, context) {
  const properties = {}
  iterateNestedSchemaComponents(schema, (field, name) => {
    const property = getFieldProperty(field, name, context)
    if (property) {
      properties[name] = property
    }
  })
  return properties
}

function getFieldProperty(field, name, formContext) {
  const descriptor = getTypeDescriptor(field)
  if (descriptor?.getProperty) {
    // Callbacks depend on the entry, so they remain rules of the field:
    const schema = Object.fromEntries(
      Object.entries(field).filter(([, value]) => !isFunction(value))
    )
    const context = formContext.createChildContext(schema, name)
    const property = descriptor.getProperty(schema, context)
    if (schema.required) {
      property.required = true
    } else if (getEmptyValue(schema, context) === null) {
      property.nullable = true
    }
    for (const key of propertyKeys) {
      if (schema[key] != null) {
        property[key] = schema[key]
      }
    }
    // Default callbacks depend on the entry too, and `null` is no value:
    const value =
      isFunction(field.default) || shouldIgnoreMissingValue(schema, context)
        ? null
        : getDefaultValue(schema, context)
    if (value != null) {
      property.default = value
    }
    return property
  }
}
