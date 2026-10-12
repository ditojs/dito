import { isObject, isString } from '@ditojs/utils'
import { getTypeDescriptor, getSourceType } from './types.ts'

export function iterateSchemaComponents(schemas, callback) {
  for (const schema of schemas) {
    if (isSingleComponentView(schema)) {
      const res = callback(schema.component, schema.name, 0)
      if (res !== undefined) {
        return res
      }
    } else if (isSchema(schema)) {
      for (const [name, component] of Object.entries(schema.components || {})) {
        const res = callback(component, name, 1)
        if (res !== undefined) {
          return res
        }
      }
    }
  }
}

export function iterateNestedSchemaComponents(schema, callback) {
  return schema
    ? iterateSchemaComponents([schema, ...getTabSchemas(schema)], callback)
    : undefined
}

export function findNestedSchemaComponent(schema, callback) {
  return (
    iterateNestedSchemaComponents(
      schema,
      component => (callback(component) ? component : undefined)
    ) ?? null
  )
}

export function someNestedSchemaComponent(schema, callback) {
  return (
    iterateNestedSchemaComponents(
      schema,
      (component, name) => (callback(component, name) ? true : undefined)
    ) ?? false
  )
}

export function hasNestedSchemaComponents(schema) {
  return someNestedSchemaComponent(schema, () => true)
}

export function isSchema(schema) {
  return isObject(schema) && isString(schema.type)
}

export function isForm(schema) {
  return isSchema(schema) && schema.type === 'form'
}

export function isView(schema) {
  return isSchema(schema) && schema.type === 'view'
}

export function isTab(schema) {
  return isSchema(schema) && schema.type === 'tab'
}

export function isPanel(schema) {
  return isSchema(schema) && schema.type === 'panel'
}

// Panels with `schema.data`, e.g. filters, don't share their schema's data:
export function isPanelWithOwnData(schema) {
  return isPanel(schema) && !!schema.data
}

export function isMenu(schema) {
  return isSchema(schema) && schema.type === 'menu'
}

export function getSchemaIdentifier(schema) {
  return JSON.stringify(schema)
}

// Views and sources are routed under their names by default:
export function getSchemaPath(schema, name, api) {
  return schema.path ?? api.normalizePath(name)
}

export function isSingleComponentView(schema) {
  return isView(schema) && isObject(schema.component)
}

export function isCompact(schema) {
  return !!schema.compact
}

export function isInlined(schema) {
  return !!(schema.inlined || schema.components)
}

// Nested components store their data under their own key in their parent's:
export function hasNestedData(schema) {
  return !!(schema.nested || getTypeDescriptor(schema)?.defaultNested)
}

export function hasLabel(schema, generateLabels) {
  const { label } = schema
  return (
    label !== false && (
      !!label ||
      generateLabels && getTypeDescriptor(schema)?.generatesLabel
    )
  )
}

export function omitsSpacing(schema) {
  return !!getTypeDescriptor(schema)?.omitsSpacing
}

export function getTabSchemas(schema) {
  return schema?.tabs ? Object.values(schema.tabs) : []
}

export function getPanelSchemas(schema) {
  return schema?.panels ? Object.values(schema.panels) : []
}

export function isObjectSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'object'
}

export function isListSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'list'
}

// The items of sources with their own resource are loaded, validated and
// submitted through their own forms, separately from the data containing them:
export function isSourceWithResource(schema) {
  return !!getSourceType(schema) && !!schema.resource
}
