import { isArray, isFunction } from '@ditojs/utils'
import {
  getTypeDescriptor,
  getChildSourceSchemas,
  getItemAdapter
} from './types.ts'
import {
  iterateNestedSchemaComponents,
  hasNestedData,
  isPanelWithOwnData
} from './structure.js'
import { getFormSchemas, getViewFormSchema } from './lookup.js'
import {
  getSchemaValue,
  getDefaultValue,
  getEmptyValue,
  shouldIgnoreMissingValue
} from './data.js'

// The limits of strings and arrays, named and applied as on the server:
const limitKeys = ['minLength', 'maxLength', 'pattern', 'minItems', 'maxItems']

// Describe the data of the form's fields as the `properties` of server models:
export function getFormProperties(schema, context) {
  const properties = {}
  const addProperty = (field, name) => {
    if (hasNestedData(field)) {
      const property = getFieldProperty(field, name, context)
      if (property) {
        properties[name] = property
      }
      // Their panels edit the data that contains them, unless they have own:
      for (const [name, panel] of Object.entries(field.panels || {})) {
        if (!isPanelWithOwnData(panel)) {
          addProperty(panel, name)
        }
      }
    } else {
      // Unnested components share the data of the form, e.g. sections:
      iterateNestedSchemaComponents(field, addProperty)
    }
  }
  iterateNestedSchemaComponents(schema, addProperty)
  return properties
}

// Describe the items of sources and nested sections. The fields of `fields()`
// callbacks depend on the entry, so their items remain undescribed:
export function getItemProperty(schema, context) {
  const forms = getFormSchemas(getViewFormSchema(schema, context) ?? schema)
  const entries = Object.entries(forms)
  if (
    entries.length > 0 &&
    !entries.some(([, form]) => isFunction(form.fields))
  ) {
    const getProperties = form => {
      const properties = getFormProperties(form, context)
      // The children of trees are sources of the items:
      for (const child of getChildSourceSchemas(schema)) {
        properties[child.name] ??= getFieldProperty(child, child.name, context)
      }
      return properties
    }
    const itemAdapter = getItemAdapter(schema)
    // Items of several forms hold the name of their form in `type`:
    return entries.length === 1 && forms.default
      ? itemAdapter
        ? (getProperties(forms.default)[itemAdapter.name] ?? null)
        : { type: 'object', properties: getProperties(forms.default) }
      : {
          type: 'object',
          discriminator: { propertyName: 'type' },
          oneOf: entries.map(([type, form]) => ({
            properties: { ...getProperties(form), type: { const: type } }
          }))
        }
  } else {
    return null
  }
}

// The data keywords of fields that all types share, as properties hold them.
// Validation resolves their callbacks with the entry's context:
export function getDataKeywords(schema, context) {
  const keywords = {}
  for (const key of limitKeys) {
    const setting = getSchemaValue(key, { schema, context })
    if (setting != null) {
      keywords[key] = setting
    }
  }
  if (getSchemaValue('required', { type: Boolean, schema, context })) {
    keywords.required = true
    // Empty arrays are values, required fields that hold them need one item:
    if (isArray(getEmptyValue(schema, context))) {
      keywords.minItems ??= 1
    }
  }
  return keywords
}

function getFieldProperty(field, name, formContext) {
  const descriptor = getTypeDescriptor(field)
  if (descriptor?.getProperty) {
    // Callbacks depend on the entry, so they remain rules of the field:
    const schema = Object.fromEntries(
      Object.entries(field).filter(([, value]) => !isFunction(value))
    )
    const context = formContext.createChildContext(schema, name)
    const property = descriptor.getProperty(schema, context, field)
    if (property) {
      Object.assign(property, getDataKeywords(schema, context))
      // Properties without a type accept `null` already:
      if (
        !property.required &&
        property.type &&
        getEmptyValue(schema, context) === null
      ) {
        property.nullable = true
      }
      // Default callbacks depend on the entry too, and `null` is no value:
      const value =
        isFunction(field.default) || shouldIgnoreMissingValue(schema, context)
          ? null
          : getDefaultValue(schema, context)
      if (value != null) {
        property.default = value
      }
    }
    return property
  }
}
