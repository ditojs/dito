import { toRaw } from 'vue'
import {
  asArray,
  isArray,
  isFunction,
  isObject,
  isString,
  labelize
} from '@ditojs/utils'
import { getSchemaValue } from './data.js'
import { createTemporaryId, isReference } from '../data.js'
import type { Context } from './types.ts'
import type { Schema } from '../types.ts'

export interface OptionsSettings {
  // The key of the ids of related options, `null` without `relate`:
  relateKey: string | null
  multiple: boolean
  // `null` for options that are their own values:
  optionValue: string | ((context: Context) => any) | null
  optionEquals: ((context: Context) => boolean) | null
  isGrouped: boolean
  createContext(values: Record<string, any>): Context
}

export function getOptionsSettings(
  schema: Schema,
  options: any[],
  {
    multiple,
    isGrouped,
    createContext
  }: Pick<OptionsSettings, 'multiple' | 'isGrouped' | 'createContext'>
): OptionsSettings {
  const getValue = (key: string[], type: any) => (
    getSchemaValue(key, { type, schema, context: createContext({}) }) ?? null
  )
  const relateKey = getRelateKey(schema)
  return {
    relateKey,
    multiple,
    // Without `options.value`, options that are objects with a `value` hold
    // their values:
    optionValue: (
      getValue(['options', 'value'], [String, Function]) ||
      relateKey ||
      getOptionKey(options, isGrouped, 'value')
    ),
    optionEquals: getValue(['options', 'equals'], Function),
    isGrouped,
    createContext
  }
}

// Read without callbacks, as values are serialized without contexts.
// `relate: true` relates by `id`, a string by the key that it names:
export function getRelateKey(schema: Schema): string | null {
  return schema.relate === true ? 'id' : schema.relate || null
}

export function groupOptions(
  options: any[],
  getGroup: (option: any) => string
) {
  const groups: Record<string, { label: string; options: any[] }> = {}
  const results = []
  for (const option of options) {
    const label = getGroup(option)
    let group = groups[label]
    if (!group) {
      group = groups[label] = { label, options: [] }
      results.push(group)
    }
    group.options.push(option)
  }
  return results
}

// Return `key` if the options are objects that hold it:
export function getOptionKey(
  options: any[],
  isGrouped: boolean,
  key: string
): string | null {
  const [firstEntry] = options
  const option = isGrouped ? firstEntry?.options?.[0] : firstEntry
  return isObject(option) && key in option ? key : null
}

// Return the key or function that gives the labels of options:
export function getOptionLabel(
  schema: Schema,
  options: any[],
  { isGrouped, context }: { isGrouped: boolean; context: Context }
): string | ((context: Context) => any) | null {
  return (
    getSchemaValue(['options', 'label'], {
      type: [String, Function],
      schema,
      context
    }) ||
    // Options that are objects with a `label` hold their labels:
    getOptionKey(options, isGrouped, 'label')
  )
}

export function getLabelForOption(
  optionLabel: string | ((context: Context) => any) | null,
  option: any,
  getContext: () => Context
) {
  return isString(optionLabel)
    ? option?.[optionLabel]
    : isFunction(optionLabel)
      ? optionLabel(getContext())
      : labelize(`${option}`)
}

// Clipboard data refers to related records by the labels of their options, as
// their ids don't carry over to other databases. Related values without an
// option use their own label:
export function getLabelForRelated(
  schema: Schema,
  options: any[],
  value: any,
  context: Context
): string | null {
  const { settings, getLabel } = getLabelSettings(schema, options, context)
  const option = findOptionForValue(
    settings,
    options,
    getValueForOption(settings, value)
  )
  return getLabel(option ?? value)
}

// Match labels exactly, but ignore case and whitespace:
export function findOptionsForLabel(
  schema: Schema,
  options: any[],
  label: string,
  context: Context
): any[] {
  const { getLabel } = getLabelSettings(schema, options, context)
  const normalizedLabel = normalizeLabel(label)
  return options.filter(
    option => normalizeLabel(getLabel(option)) === normalizedLabel
  )
}

export function getValueForOption(settings: OptionsSettings, option: any) {
  if (shouldSetTemporaryId(settings, option)) {
    // Until selected and given temporary ids, they're their own values:
    return toRaw(option)
  }
  const { optionValue, createContext } = settings
  return isString(optionValue)
    ? (option?.[optionValue] ?? null)
    : isFunction(optionValue)
      ? optionValue(createContext({ option }))
      : option
}

export function findOptionForValue(
  settings: OptionsSettings,
  options: any[],
  value: any
): any {
  const { optionEquals, isGrouped, createContext } = settings
  const findOption = (options: any[], isGrouped: boolean): any => {
    for (const option of options) {
      if (isGrouped) {
        const found = findOption(option.options, false)
        if (found !== undefined) {
          return found
        }
      } else if (
        optionEquals
          ? optionEquals(createContext({ value, option }))
          : value === getValueForOption(settings, option)
      ) {
        return option
      }
    }
  }
  return findOption(options, isGrouped)
}

// Values without an option stay selected, for components to show them:
export function getSelectedValue(settings: OptionsSettings, value: any) {
  const { relateKey } = settings
  const convertValue = (value: any) =>
    relateKey ? getValueForOption(settings, value) : value
  return settings.multiple && isArray(value)
    ? value.map(convertValue)
    : convertValue(value)
}

export function getValueForSelectedValue(
  settings: OptionsSettings,
  selectedValue: any,
  value: any,
  { findOption }: { findOption(value: any): any }
) {
  const { relateKey } = settings
  const convertValue = (selected: any) => {
    if (!relateKey) {
      return selected
    }
    // Keep related objects without options, held in `value`:
    const option = (
      findOption(selected) ??
      asArray(value).find(
        (object: any) => getValueForOption(settings, object) === selected
      )
    )
    if (shouldSetTemporaryId(settings, option)) {
      // New items get temporary ids for the relation to reference on save.
      // Set it on the option itself, as a copy wouldn't propagate:
      option[relateKey] = createTemporaryId()
    }
    return option
  }
  return settings.multiple && isArray(selectedValue)
    ? selectedValue.map(convertValue)
    : convertValue(selectedValue)
}

// References become their related options, other values stay, also without
// options. Return `null` if `value` stays:
export function getReplacedValue(
  settings: OptionsSettings,
  options: any[],
  value: any
): { value: any } | null {
  const { relateKey } = settings
  const option = (
    relateKey &&
    isReference(value, relateKey) &&
    findOptionForValue(settings, options, getValueForOption(settings, value))
  )
  return option ? { value: option } : null
}

function getLabelSettings(schema: Schema, options: any[], context: Context) {
  const settings = getOptionsSettings(schema, options, {
    multiple: false,
    isGrouped: false,
    createContext: values => context.extend({ options, ...values })
  })
  const optionLabel = getOptionLabel(schema, options, {
    isGrouped: false,
    context
  })
  return {
    settings,
    getLabel: (option: any): string | null => (
      getLabelForOption(optionLabel, option, () =>
        settings.createContext({ option })
      ) ?? null
    )
  }
}

function normalizeLabel(label: any) {
  return `${label ?? ''}`.trim().replace(/\s+/g, ' ').toLowerCase()
}

function shouldSetTemporaryId(settings: OptionsSettings, option: any) {
  const { relateKey } = settings
  return !!relateKey && isObject(option) && option[relateKey] == null
}
