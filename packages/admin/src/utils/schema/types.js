import { isObject } from '@ditojs/utils'

const typeComponents = {}

const unknownTypeReported = {}

export function registerTypeComponent(type, component) {
  typeComponents[type] = component
}

export function getTypeComponent(type, allowNull = false) {
  const component = typeComponents[type] || null
  if (!component && !allowNull && !unknownTypeReported[type]) {
    // Report each missing type only once, to avoid flooding the console:
    unknownTypeReported[type] = true
    throw new Error(`Unknown Dito.js component type: '${type}'`)
  }
  return component
}

function getType(schemaOrType) {
  return isObject(schemaOrType) ? schemaOrType.type : schemaOrType
}

export function getTypeOptions(schemaOrType) {
  return getTypeComponent(getType(schemaOrType), true) ?? null
}

export function getSourceType(schemaOrType) {
  return (
    getTypeOptions(schemaOrType)?.getSourceType?.(getType(schemaOrType)) ??
    null
  )
}
