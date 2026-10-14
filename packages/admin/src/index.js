import { asArray } from '@ditojs/utils'
import DitoAdmin from './DitoAdmin.js'
import {
  defineType as defineTypeDescriptor,
  getTypes
} from './utils/schema/types.ts'
import { wrapCustomComponent } from './types/DitoTypeComponent.vue'

export { DitoAdmin }
export default DitoAdmin

// The members of the public `TypeDescriptor`:
const descriptorKeys = new Set([
  'type',
  'defaultValue',
  'defaultNested',
  'defaultVisible',
  'defaultMultiple',
  'defaultWidth',
  'defaultExclude',
  'ignoresMissingValue',
  'treatsNullAsMissing',
  'resolvesValue',
  'generatesLabel',
  'hasLabel',
  'omitsSpacing',
  'rendersLabel',
  'submitsData',
  'hasEmbeddedForms',
  'getOptionsDataSchema',
  'getDisplayValue',
  'getValidations',
  'setupSchema',
  'deserializeValue',
  'serializeValue'
])

// The keys of 3.x and what replaces them:
const replacedDescriptorKeys = {
  excludeValue: 'defaultExclude',
  generateLabel: 'generatesLabel',
  ignoreMissingValue: 'ignoresMissingValue',
  treatNullAsMissing: 'treatsNullAsMissing',
  omitSpacing: 'omitsSpacing',
  valueFromDataSchema: 'resolvesValue',
  rendersOwnLabel: 'hasLabel',
  processSchema: 'setupSchema',
  processValue: 'serializeValue',
  getTypeValidations: 'getValidations'
}

// All types defined so far are dito's own, as `DitoAdmin` imports them:
const builtInTypes = new Set(getTypes())

// Custom type components receive `schema`, `context` and `modelValue`, like the
// components of `type: 'component'`:
export function defineType({ component, override, ...descriptor }) {
  for (const key of Object.keys(descriptor)) {
    if (!descriptorKeys.has(key)) {
      const replacement = replacedDescriptorKeys[key]
      throw new Error(
        replacement
          ? `Invalid type descriptor key '${key}', use '${replacement}'.`
          : `Unknown type descriptor key: '${key}'.`
      )
    }
  }
  for (const type of asArray(descriptor.type)) {
    if (builtInTypes.has(type) && !override) {
      throw new Error(
        `Unable to redefine built-in type '${type}' without 'override: true'.`
      )
    }
  }
  return defineTypeDescriptor({
    ...descriptor,
    component: wrapCustomComponent(component)
  })
}
