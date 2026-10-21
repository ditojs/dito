import SchemaContext from '../../SchemaContext.js'
import {
  isArray,
  isFunction,
  isDate,
  isString,
  formatPlainDate
} from '@ditojs/utils'
import { convertToDate, convertTimeToDate, formatTime } from '../date.js'
import { createReference } from '../data.js'
import { getStoredFiles } from '../upload.ts'
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
  shouldIgnoreMissingValue,
  resolveValue
} from './data.js'
import { getValueValidationErrors } from './validation.js'
import { getRelateKey } from './options.ts'

// The limits of strings and arrays, named and applied as on the server:
const limitKeys = ['minLength', 'maxLength', 'pattern', 'minItems', 'maxItems']

// The keywords that written properties validate with the validators of the
// same names:
const validatedKeys = [
  'required',
  ...limitKeys,
  'minimum',
  'maximum',
  'range',
  'decimals'
]

const supportedTypes = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'timestamp',
  'asset',
  'object',
  'array'
])

const dateTypes = new Set(['date', 'datetime', 'timestamp'])

// The validators of the server's formats, `uri` with the scheme it requires:
const validatorsByFormat = {
  'email': 'email',
  'hostname': 'hostname',
  'password': 'password',
  'uri': 'url',
  'iso-time': 'isoTime'
}

// Not supported yet:
const unsupportedKeys = ['definitions', '$ref']

// Written properties: a value of a form's data and its keywords, which may be
// functions of the entry's context, e.g. `required`, `if` or `default`:
export class PropertyNode {
  #itemForms

  constructor(name, property) {
    this.name = name
    this.property = property
    // Properties hold no fields, which only fields have for structure:
    this.fields = []
    this.source = getPropertySource(property)
    this.#itemForms = getItemForms(property)
  }

  getWalkedNode(entry, { shouldSkipIrrelevant }) {
    return !shouldSkipIrrelevant || this.isRelevant(entry) ? this : null
  }

  // Like for fields, an `if` that fails counts as relevant:
  isRelevant(entry) {
    try {
      return getSchemaValue('if', {
        type: Boolean,
        schema: this.property,
        context: this.#createContext(entry),
        default: true
      })
    } catch (error) {
      console.error(error)
      return true
    }
  }

  getItemForms() {
    return this.#itemForms
  }

  getValidationErrors(entry) {
    const { property } = this
    const context = this.#createContext(entry)
    const get = key => getSchemaValue(key, { schema: property, context })
    const validations = {}
    for (const key of validatedKeys) {
      const setting = get(key)
      if (setting != null && setting !== false) {
        validations[key] = setting
      }
    }
    if (property.type === 'integer') {
      validations.integer = true
    } else if (dateTypes.has(property.type)) {
      validations.date = true
    }
    const format = get('format')
    if (format) {
      validations[validatorsByFormat[format]] = true
    }
    const values = get('enum')
    if (values) {
      validations.enum = value => values.includes(value)
    }
    if (property.validate) {
      validations.validate = value =>
        property.validate(context.extend({ value }))
    }
    return getValueValidationErrors(entry.data[entry.name], validations)
  }

  // The data model records the value for its computes:
  getRecordedValue() {
    const { name, property } = this
    return property.computeValue
      ? { schema: property, form: { properties: { [name]: property } } }
      : null
  }

  // Irrelevant values get no defaults, and unchanged passwords stay missing.
  // The data model writes computed values with their defaults:
  hasMissingValue(entry, { shouldSetDefaultsOfComponentsWithCompute } = {}) {
    return (
      !(entry.name in entry.data) &&
      !(
        shouldSetDefaultsOfComponentsWithCompute === false &&
        this.property.computeValue
      ) &&
      this.#get('format', entry) !== 'password' &&
      this.isRelevant(entry)
    )
  }

  getDefaultValue(entry, options) {
    const { default: def } = this.property
    return !this.hasMissingValue(entry, options)
      ? undefined
      : def !== undefined
        ? resolveValue(def, () => this.#createContext(entry))
        : getPropertyEmptyValue(this.property, this.#get('nullable', entry))
  }

  deserialize(value, entry) {
    const { property } = this
    if (dateTypes.has(property.type)) {
      value = convertToDate(value)
    } else if (this.#get('format', entry) === 'iso-time') {
      // `DitoTimeField` edits times as `Date` objects too:
      value = convertTimeToDate(value)
    }
    return property.deserializeValue
      ? property.deserializeValue(this.#createContext(entry, { value }))
      : value
  }

  // Irrelevant and excluded values aren't sent:
  serialize(value, entry) {
    const { property } = this
    if (this.isRelevant(entry)) {
      const { serializedData, serializedRootData } = entry
      const createContext = value =>
        this.#createContext(entry, {
          value,
          serializedData,
          serializedRootData
        })
      value = this.#convertValue(value, entry)
      if (property.serializeValue) {
        value = property.serializeValue(createContext(value))
      }
      return value === undefined || this.isExcluded(entry) ? undefined : value
    }
  }

  // Computed properties are stored by the server, which doesn't accept them:
  isExcluded(entry) {
    return !!(this.#get('exclude', entry) || this.#get('computed', entry))
  }

  // Convert values by their type, like the types of fields do:
  #convertValue(value, entry) {
    const { type } = this.property
    const relateKey = getRelateKey(this.property)
    if (relateKey) {
      return isArray(value)
        ? value.map(item => createReference(item, relateKey))
        : createReference(value, relateKey)
    } else if (isDate(value) && dateTypes.has(type)) {
      // Send plain dates, so they can't shift to another day through time
      // zones:
      return type === 'date' ? formatPlainDate(value) : value.toISOString()
    } else if (isDate(value) && this.#get('format', entry) === 'iso-time') {
      return formatTime(value)
    } else if (type === 'asset') {
      return getStoredFiles(value)[0] ?? null
    } else if (type === 'array' && this.property.items?.type === 'asset') {
      // Leave out the files that weren't uploaded:
      return value?.filter(file => file)
    } else if (type === 'string' && isString(value)) {
      value = this.#get('trim', entry) ? value.trim() : value
      return value === '' && this.#get('nullable', entry) ? null : value
    }
    return value
  }

  #get(key, entry) {
    return getSchemaValue(key, {
      schema: this.property,
      context: this.#createContext(entry)
    })
  }

  #createContext(entry, values = null) {
    const { data, name, dataPath, itemDataPath, rootData, services } = entry
    return new SchemaContext(services, {
      schema: this.property,
      name,
      nested: true,
      data,
      dataPath,
      itemDataPath,
      rootData,
      ...(values ?? {
        get value() {
          return data[name]
        }
      })
    })
  }
}

export function createPropertyNodes(properties) {
  return new Map(
    Object.entries(properties).map(([name, property]) => [
      name,
      new PropertyNode(name, property)
    ])
  )
}

// Forms describe their data with either `fields` or `properties`:
export function checkFormProperties(schema) {
  const { fields, properties } = schema
  if (properties) {
    if (fields) {
      throw new Error(
        'Unable to set up the form: It has both `fields` and `properties`.'
      )
    }
    checkProperties(properties)
  }
}

// Fail early on what written properties don't support yet:
export function checkProperties(properties) {
  Object.values(properties).forEach(checkProperty)
}

function checkProperty(property) {
  const { type, format, items, forms, relate } = property
  const key = unsupportedKeys.find(key => key in property)
  if (key) {
    throw new Error(`Unsupported property keyword: '${key}'.`)
  }
  if (!supportedTypes.has(type)) {
    throw new Error(`Unsupported property type: '${type}'.`)
  }
  if (format && !isFunction(format) && !validatorsByFormat[format]) {
    throw new Error(`Unsupported property format: '${format}'.`)
  }
  if (type === 'array' && !forms && !items) {
    throw new Error(`Unsupported property: 'array' without 'items'.`)
  }
  // Relations hold references to objects, alone or in lists:
  const related = type === 'array' ? items : property
  if (relate && (related?.type !== 'object' || related.properties)) {
    throw new Error(`Unsupported property: 'relate' on '${type}'.`)
  }
  if (items) {
    checkProperty(items)
  }
  for (const { properties } of [property, ...Object.values(forms ?? {})]) {
    if (properties) {
      checkProperties(properties)
    }
  }
}

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
      if (form.properties) {
        return form.properties
      }
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

// Values that hold items, of arrays or objects with properties. Relations hold
// references, not items:
function getPropertySource(property) {
  const { type, properties, items, forms, idKey, orderKey, relate } = property
  return !relate && (type === 'array' || properties)
    ? {
        isSource: true,
        isList: type === 'array',
        hasForms: true,
        idKey: idKey || 'id',
        orderKey: orderKey ?? null,
        hasItemTypes: Object.keys(forms ?? {}).length > 1,
        hasResource: false,
        // Lists of primitives are walked with their items wrapped:
        itemAdapter: items && !items.properties ? primitiveItemAdapter : null
      }
    : null
}

// The forms of the items in the value, by their `type`. Primitives are walked
// as the property of their wrapper:
function getItemForms({ type, properties, items, forms, relate }) {
  return !relate && (type === 'array' || properties)
    ? [
        {
          forms: (
            forms ??
            {
              default: items
                ? items.properties
                  ? items
                  : { properties: { [primitiveItemAdapter.name]: items } }
                : { properties }
            }
          ),
          childSourceSchemas: []
        }
      ]
    : []
}

const primitiveItemAdapter = {
  name: 'value',
  wrap: value => ({ value }),
  unwrap: item => item.value
}

// Empty values follow the server, `nullable` ones are `null`:
function getPropertyEmptyValue({ type, properties }, isNullable) {
  return isNullable
    ? null
    : ({ string: '', boolean: false, array: [] }[type] ??
      (properties ? {} : null))
}
