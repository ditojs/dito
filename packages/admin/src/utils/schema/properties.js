import {
  isArray,
  isFunction,
  isDate,
  isString,
  pickBy,
  formatPlainDate
} from '@ditojs/utils'
import { computed, toRaw } from 'vue'
import SchemaContext from '../../SchemaContext.js'
import { convertToDate, convertTimeToDate, formatTime } from '../date.js'
import { createReference } from '../data.js'
import { getStoredFiles, getUploadLimits } from '../upload.ts'
import {
  getTypeDescriptor,
  getChildSourceSchemas,
  getItemAdapter
} from './types.ts'
import {
  iterateNestedSchemaComponents,
  hasNestedData,
  isPanelWithOwnData,
  isSourceWithResource
} from './structure.js'
import { getFormSchemas, getViewFormSchema } from './lookup.js'
import {
  getSchemaValue,
  getDefaultValue,
  getEmptyValue,
  getEditedValue,
  resolveValue,
  callOrLog
} from './data.js'
import { createValueContext } from './walk.js'
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

// The keywords that fields may hold as callbacks, which the properties of their
// nodes keep, to be resolved per entry:
const callbackKeys = [
  ...validatedKeys,
  'nullable',
  'default',
  'exclude',
  'trim'
]

// The key in `fieldsByKey` of the field whose type's hooks a derived property
// runs, without a name in properties:
const typeKey = Symbol('type')

// The nodes of written properties and of the properties of fields by schema,
// computed so that fields get new ones once `setupForm()` changes them. Fields
// whose types read callbacks to derive their property derive it per entry:
const nodesBySchema = new WeakMap()

// Written properties: a value of a form's data and its keywords, which may be
// functions of the entry's context, e.g. `required`, `if` or `default`.
// Properties derived from fields resolve each keyword with the context of the
// field in `fieldsByKey` that it came from:
export class PropertyNode {
  #itemForms
  #type

  constructor(name, property, fieldsByKey = null) {
    this.name = name
    this.property = property
    this.fieldsByKey = fieldsByKey
    this.#type = getTypeDescriptor(fieldsByKey?.[typeKey])
    this.source = getPropertySource(property)
    // Properties have no options, so copies keep the ids of their relations:
    this.relation = property.relate
      ? { schema: property, hasOptions: false }
      : null
    // The forms of the items by their `type`:
    this.#itemForms = this.source
      ? [
          {
            forms: property.forms ?? {
              default: property.items
                ? getArrayItemForm(property.items).form
                : { properties: property.properties }
            },
            childSourceSchemas: []
          }
        ]
      : []
  }

  // Like for fields, an `if` that fails counts as relevant:
  isRelevant(entry) {
    return callOrLog(
      () =>
        getSchemaValue('if', {
          type: Boolean,
          schema: this.property,
          context: this.#createContext(entry, 'if'),
          default: true
        }),
      true
    )
  }

  getRelevantNode(entry) {
    return this.isRelevant(entry) ? this : null
  }

  getPropertyNode() {
    return this
  }

  getItemForms() {
    return this.#itemForms
  }

  getValidationErrors(entry) {
    const { property } = this
    const get = key => this.#get(key, entry)
    // The validations of the field's type come first, as for fields, and win
    // over the keywords. Its range holds both limits:
    const validations = {
      ...this.#type?.getValidations?.(this.#createContext(entry, typeKey))
    }
    const isValidatedByType = key => (
      key in validations ||
      !!validations.range && (key === 'minimum' || key === 'maximum')
    )
    for (const key of validatedKeys) {
      const setting = get(key)
      if (setting != null && setting !== false && !isValidatedByType(key)) {
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
    // Fields keep values that have no option, so only written properties
    // validate `enum`:
    const values = !this.fieldsByKey && get('enum')
    if (values) {
      validations.enum = value => values.includes(value)
    }
    if (property.validate) {
      const context = this.#createContext(entry, 'validate')
      validations.validate = value =>
        property.validate(context.extend({ value }))
    }
    // Fields validate the value as they edit it, written properties the stored
    // one, as the server does:
    const value = entry.data[entry.name]
    const field = this.fieldsByKey?.[typeKey]
    return getValueValidationErrors(
      field
        ? getEditedValue(field, value, () =>
            this.#createContext(entry, typeKey)
          )
        : value,
      validations
    )
  }

  // The data model records the value for its computes, derived properties by
  // the field of `computeValue()`:
  getRecordedSchema() {
    const { name, property } = this
    const field = this.fieldsByKey?.computeValue
    return field
      ? { schema: field, form: { fields: { [name]: field } } }
      : property.computeValue
        ? { schema: property, form: { properties: { [name]: property } } }
        : null
  }

  // Unchanged passwords stay missing. The data model writes computed values
  // with their defaults:
  shouldSetDefaultValue(entry, {
    shouldSetDefaultsOfComputedValues = true
  } = {}) {
    return (
      this.#isMissing(entry) &&
      (shouldSetDefaultsOfComputedValues || !this.property.computeValue) &&
      this.#get('format', entry) !== 'password' &&
      !this.#ignoresMissingValue(entry)
    )
  }

  // Types of fields may leave missing values out, per entry:
  #ignoresMissingValue(entry) {
    const ignoresMissingValue = this.#type?.ignoresMissingValue
    return isFunction(ignoresMissingValue)
      ? ignoresMissingValue(this.#createContext(entry, typeKey))
      : !!ignoresMissingValue
  }

  // Values are missing without their key, and as `null` in typed properties
  // unless `nullable`:
  #isMissing(entry) {
    const { data, name } = entry
    return (
      !(name in data) || (
        data[name] === null &&
        !!this.property.type &&
        !this.#get('nullable', entry)
      )
    )
  }

  getDefaultValue(entry, options) {
    const { default: def } = this.property
    return !this.shouldSetDefaultValue(entry, options)
      ? undefined
      : def !== undefined
        ? resolveValue(def, () => this.#createContext(entry, 'default'))
        : this.#get('nullable', entry)
          ? null
          : getPropertyEmptyValue(this.property)
  }

  // Keep the values that are there, also `null`, and give missing values their
  // default:
  getValueOrDefault(entry) {
    const { data, name } = entry
    return name in data ? data[name] : this.getDefaultValue(entry)
  }

  deserialize(value, entry) {
    const { property } = this
    if (dateTypes.has(property.type)) {
      value = convertToDate(value)
    } else if (this.#get('format', entry) === 'iso-time') {
      // `DitoTimeField` edits times as `Date` objects too:
      value = convertTimeToDate(value)
    }
    return this.#callValueHooks('deserializeValue', value, entry)
  }

  // Excluded values aren't sent, and `exclude()` sees the serialized value:
  serialize(value, entry) {
    value = this.#callValueHooks(
      'serializeValue',
      this.#convertValue(value, entry),
      entry
    )
    return value === undefined || this.isExcluded(entry, { value })
      ? undefined
      : value
  }

  // Computed properties are stored by the server, which doesn't accept them:
  isExcluded(entry, values = null) {
    return !!(
      this.#get('exclude', entry, values) ||
      this.#get('computed', entry, values)
    )
  }

  // Written assets have no limits, their widgets check them. Upload fields
  // hold their own:
  getUploadLimits(entry) {
    const { type, items } = this.property
    const field = this.fieldsByKey?.[typeKey]
    return type === 'asset' || items?.type === 'asset'
      ? field
        ? getUploadLimits(field, this.#createContext(entry, typeKey))
        : { extensions: undefined, maxSize: undefined }
      : null
  }

  // Show dates and times in the formats of the admin, like their widgets, and
  // the values of fields as their types display them:
  getDisplayValue(entry) {
    const { type } = this.property
    const value = entry.data[entry.name]
    const isTime = this.#get('format', entry) === 'iso-time'
    return this.#type?.getDisplayValue
      ? this.#type.getDisplayValue(this.#createContext(entry, typeKey))
      : isDate(value) && (dateTypes.has(type) || isTime)
        ? this.#createContext(entry).format(value, {
            date: !isTime,
            time: type !== 'date'
          })
        : value
  }

  // The hooks of the field's type run before the property's own, as for
  // fields:
  #callValueHooks(key, value, entry) {
    for (const [hookKey, convert] of [
      [typeKey, this.#type?.[key]],
      [key, this.property[key]]
    ]) {
      if (convert) {
        value = convert(this.#createContext(entry, hookKey, { value }))
      }
    }
    return value
  }

  // Convert values by their type, like the types of fields do:
  #convertValue(value, entry) {
    const { type } = this.property
    const relateKey = getRelateKey(this.property)
    if (relateKey) {
      return createReference(value, relateKey)
    } else if (isDate(value) && dateTypes.has(type)) {
      // Send plain dates, so they can't shift to another day through time
      // zones:
      return type === 'date' ? formatPlainDate(value) : value.toISOString()
    } else if (isDate(value) && this.#get('format', entry) === 'iso-time') {
      return formatTime(value)
    } else if (type === 'asset') {
      // Send the stored file as upload fields do, else `null`:
      return getStoredFiles(value)[0] || null
    } else if (type === 'string' && isString(value)) {
      value = this.#get('trim', entry) ? value.trim() : value
      return value === '' && this.#get('nullable', entry) ? null : value
    }
    return value
  }

  #get(key, entry, values = null) {
    const { property } = this
    return getSchemaValue(key, {
      schema: property,
      // Only callbacks need a context:
      context: isFunction(property[key])
        ? this.#createContext(entry, key, values)
        : null
    })
  }

  #createContext(entry, key = null, values = null) {
    const schema = this.fieldsByKey?.[key] ?? this.property
    return createValueContext(schema, entry, values)
  }
}

export function createPropertyNodes(properties) {
  return new Map(
    Object.entries(properties).map(([name, property]) => [
      name,
      getPropertyNode(name, property)
    ])
  )
}

export function getPropertyNode(name, property) {
  return getCachedNode(property, () => ({
    node: new PropertyNode(name, property),
    isPerEntry: false
  })).node
}

// The node of the property of a field, `null` for types without a value:
export function getFieldPropertyNode(field, name, entry) {
  const { node, isPerEntry } = getStaticFieldNode(field, name, entry.services)
  if (isPerEntry) {
    const context = createValueContext(field, entry)
    const property = getTypeProperty(field, context, callback =>
      callback(context)
    )
    return createFieldPropertyNode(field, name, property, context)
  } else {
    return node
  }
}

export function isPropertyPerEntry(field, name, services) {
  return getStaticFieldNode(field, name, services).isPerEntry
}

// Derive the property once per field, without the entry's data. If its type
// reads callbacks, the property depends on the entry:
function getStaticFieldNode(field, name, services) {
  return getCachedNode(field, () => {
    const context = SchemaContext.createForSchema(services, {
      schema: field,
      name
    })
    let isPerEntry = false
    const property = getTypeProperty(field, context, () => {
      isPerEntry = true
    })
    return {
      node: isPerEntry
        ? null
        : createFieldPropertyNode(field, name, property, context),
      isPerEntry
    }
  })
}

// Merge the properties of several fields of a value: each keyword comes from
// the first field that defines it, in form order, else from the first one that
// derives it:
export function mergePropertyNodes(name, nodes) {
  nodes = nodes.filter(node => node)
  if (nodes.length > 1) {
    const property = {}
    const fieldsByKey = {}
    const keys = new Set(
      nodes.flatMap(({ fieldsByKey }) => Reflect.ownKeys(fieldsByKey))
    )
    for (const key of keys) {
      const nodesWithKey = nodes.filter(({ fieldsByKey }) => key in fieldsByKey)
      const isDefining = ({ fieldsByKey }) => (
        fieldsByKey[key][key] !== undefined
      )
      const node = nodesWithKey.find(isDefining) ?? nodesWithKey[0]
      if (key in node.property) {
        property[key] = node.property[key]
      }
      fieldsByKey[key] = node.fieldsByKey[key]
    }
    return new PropertyNode(name, property, fieldsByKey)
  } else {
    return nodes[0] ?? null
  }
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
      // Sources with their own resource hold no data of the form:
      const property = isSourceWithResource(field)
        ? null
        : getFieldProperty(field, name, context)
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
// callbacks depend on the entry, so their items remain undescribed. Forms may
// contain themselves, e.g. in lists of blocks, so describe their properties
// only when read:
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
        : {
            type: 'object',
            get properties() {
              return getProperties(forms.default)
            }
          }
      : {
          type: 'object',
          discriminator: { propertyName: 'type' },
          oneOf: entries.map(([type, form]) => ({
            get properties() {
              return { ...getProperties(form), type: { const: type } }
            }
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
  if (getTypeDescriptor(field)?.getProperty) {
    const context = formContext.createChildContext(field, name)
    return completeProperty(field, getTypeProperty(field, context), context)
  }
}

// The property that the field's type derives, `null` for types without a
// value, e.g. buttons, unless the field declares validation, and `{}` for types
// without `getProperty()`, which hold any value. Callbacks depend on the entry,
// so `getProperty()` reads them through `readCallback()`:
function getTypeProperty(field, context, readCallback = () => undefined) {
  const descriptor = getTypeDescriptor(field)
  const getValue = (target, key) => {
    const value = target[key]
    return isFunction(value) ? readCallback(value) : value
  }
  const property = descriptor?.getProperty
    ? descriptor.getProperty(
        new Proxy(field, {
          get: getValue,
          has: (target, key) => getValue(target, key) !== undefined
        }),
        context
      )
    : descriptor?.defaultValue !== undefined
      ? {}
      : null
  const isValidated = (
    !!descriptor &&
    [...validatedKeys, 'validate'].some(key => field[key] != null)
  )
  return property ?? (isValidated ? {} : null)
}

// Complete the property of the field's type with what nodes of fields resolve
// per entry: callbacks, value hooks and the type's own hooks:
function createFieldPropertyNode(field, name, property, context) {
  property = completeProperty(field, property, context)
  if (property) {
    const {
      trim,
      relate,
      exclude = getTypeDescriptor(field).defaultExclude
    } = getStaticSchema(field)
    const { validate, computeValue, serializeValue, deserializeValue } = field
    Object.assign(
      property,
      pickBy(
        {
          trim,
          relate,
          exclude,
          validate,
          computeValue,
          serializeValue,
          deserializeValue
        },
        value => value !== undefined
      )
    )
    for (const key of callbackKeys) {
      if (isFunction(field[key])) {
        property[key] = field[key]
      }
    }
    // Required arrays need one item, as in `getDataKeywords()`, also per entry:
    const { required } = field
    if (
      isFunction(required) &&
      property.type === 'array' &&
      property.minItems === undefined
    ) {
      property.minItems = context => (required(context) ? 1 : null)
    }
    return new PropertyNode(
      name,
      property,
      Object.fromEntries(
        [...Object.keys(property), typeKey].map(key => [key, field])
      )
    )
  } else {
    return null
  }
}

// Add the field's data keywords and its default, without its callbacks:
function completeProperty(field, property, context) {
  if (property) {
    const schema = getStaticSchema(field)
    Object.assign(property, getDataKeywords(schema, context))
    // Properties without a type accept `null` already:
    if (property.type && getEmptyValue(schema, context) === null) {
      property.nullable = true
    }
    // Default callbacks depend on the entry too, and `null` is no value:
    const value = isFunction(field.default)
      ? null
      : getDefaultValue(schema, context)
    if (value != null) {
      property.default = value
    }
  }
  return property
}

function getStaticSchema(field) {
  return Object.fromEntries(
    Object.entries(field).filter(([, value]) => !isFunction(value))
  )
}

// Values that hold items, of arrays or objects with properties. Relations hold
// references, not items:
function getPropertySource(property) {
  const { type, properties, items, forms, idKey, orderKey, relate } = property
  return !relate && (type === 'array' || properties)
    ? {
        isList: type === 'array',
        hasForms: true,
        idKey: idKey || 'id',
        orderKey: orderKey ?? null,
        hasItemTypes: Object.keys(forms ?? {}).length > 1,
        hasResource: false,
        hasSubmitButton: false,
        itemAdapter: items ? getArrayItemForm(items).itemAdapter : null
      }
    : null
}

// Arrays of objects hold the items of their form, arrays of primitives hold
// values that the walk wraps as the value of their form:
export function getArrayItemForm(items) {
  return items.properties
    ? { form: items, itemAdapter: null }
    : {
        form: { properties: { [primitiveItemAdapter.name]: items } },
        itemAdapter: primitiveItemAdapter
      }
}

const primitiveItemAdapter = {
  name: 'value',
  wrap: value => ({ value }),
  unwrap: item => item.value
}

// The empty values of the server's types, for values that aren't `nullable`.
// Values without a type have none, and stay missing:
export function getPropertyEmptyValue({ type, properties }) {
  return properties
    ? {}
    : type
      ? ({ string: '', boolean: false, array: [] }[type] ?? null)
      : undefined
}

function getCachedNode(schema, createNode) {
  let node = nodesBySchema.get(toRaw(schema))
  if (!node) {
    node = computed(createNode)
    nodesBySchema.set(toRaw(schema), node)
  }
  return node.value
}
