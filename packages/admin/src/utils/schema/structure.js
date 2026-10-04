import { isObject, isString } from '@ditojs/utils'
import { getTypeOptions, getSourceType } from './types.js'

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
      component => (callback(component) ? true : undefined)
    ) ?? false
  )
}

export function everyNestedSchemaComponent(schema, callback) {
  return (
    iterateNestedSchemaComponents(
      schema,
      component => (callback(component) ? undefined : false)
    ) ?? true
  )
}

export function hasNestedSchemaComponents(schema) {
  return someNestedSchemaComponent(schema, () => true) ?? false
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

export function isMenu(schema) {
  return isSchema(schema) && schema.type === 'menu'
}

export function getSchemaIdentifier(schema) {
  return JSON.stringify(schema)
}

export function isSingleComponentView(schema) {
  return (
    isView(schema) &&
    isObject(schema.component)
  )
}

export function isCompact(schema) {
  return !!schema.compact
}

export function isInlined(schema) {
  return !!(schema.inlined || schema.components)
}

export function isNested(schema) {
  return !!(schema.nested || getTypeOptions(schema)?.defaultNested === true)
}

export function hasLabel(schema, generateLabels) {
  const { label } = schema
  return (
    label !== false && (
      !!label ||
      generateLabels && getTypeOptions(schema)?.generateLabel
    )
  )
}

export function omitSpacing(schema) {
  return !!getTypeOptions(schema)?.omitSpacing
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
