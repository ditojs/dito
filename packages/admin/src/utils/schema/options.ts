import { toRaw } from 'vue'
import { asArray, isArray, isFunction, isObject, isString } from '@ditojs/utils'
import { getSchemaValue } from './data.js'
import { createTemporaryId, isReference } from '../data.js'
import type { Context } from './types.ts'
import type { Schema } from '../types.ts'

export interface OptionsSettings {
  relate: boolean
  multiple: boolean
  // `null` for options that are their own values:
  optionValue: string | ((context: Context) => any) | null
  optionEquals: ((context: Context) => boolean) | null
  groupBy: string | null
  createContext(values: Record<string, any>): Context
}

export function getOptionsSettings(
  schema: Schema,
  options: any[],
  {
    multiple,
    groupBy,
    createContext
  }: Pick<OptionsSettings, 'multiple' | 'groupBy' | 'createContext'>
): OptionsSettings {
  const getValue = (key: string[], type: any) => (
    getSchemaValue(key, { type, schema, context: createContext({}) }) ?? null
  )
  // Without callbacks, as values are processed without contexts:
  const relate = !!schema.relate
  return {
    relate,
    multiple,
    // Without `options.value`, options that are objects with a `value` hold
    // their values:
    optionValue: (
      getValue(['options', 'value'], [String, Function]) ||
      relate && 'id' ||
      getOptionKey(options, groupBy, 'value')
    ),
    optionEquals: getValue(['options', 'equals'], Function),
    groupBy,
    createContext
  }
}

export function groupOptions(options: any[], groupBy: string) {
  const groups: Record<string, { label: string; options: any[] }> = {}
  const results = []
  for (const option of options) {
    const label = option[groupBy]
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
  groupBy: string | null,
  key: string
): string | null {
  const [firstEntry] = options
  const option = groupBy ? firstEntry?.options?.[0] : firstEntry
  return isObject(option) && key in option ? key : null
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
  const { optionEquals, groupBy, createContext } = settings
  const findOption = (options: any[], isGrouped: boolean): any => {
    for (const option of options) {
      if (isGrouped) {
        const found = findOption(option.options, false)
        if (found) {
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
  return findOption(options, !!groupBy)
}

// Values without an option select `null`, unless there are no options yet:
export function getSelectedValue(
  settings: OptionsSettings,
  value: any,
  { hasOptions, findOption }: SelectedValueOptions
) {
  const { relate, optionValue } = settings
  const convertValue = (value: any) => {
    const val = relate ? getValueForOption(settings, value) : value
    return hasOptions
      ? (optionValue ? findOption(val) : val)
        ? val
        : null
      : value
  }
  return settings.multiple && isArray(value)
    ? value.map(convertValue).filter(value => value !== null)
    : convertValue(value)
}

export function getValueForSelectedValue(
  settings: OptionsSettings,
  selectedValue: any,
  value: any,
  { findOption }: Pick<SelectedValueOptions, 'findOption'>
) {
  const convertValue = (selected: any) => {
    if (!settings.relate) {
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
      option.id = createTemporaryId()
    }
    return option
  }
  return settings.multiple && isArray(selectedValue)
    ? selectedValue.map(convertValue)
    : convertValue(selectedValue)
}

// Values whose option disappeared become `null` unless `taggable`, and
// references become their options' objects. Return `null` if `value` stays:
export function getReplacedValue(
  schema: Schema,
  settings: OptionsSettings,
  options: any[],
  value: any
): { value: any } | null {
  const findOption = (value: any) =>
    findOptionForValue(settings, options, value)
  const selectedValue = getSelectedValue(settings, value, {
    hasOptions: options.length > 0,
    findOption
  })
  return (
    options.length > 0 && (
      selectedValue === null && value !== null && !schema.taggable ||
      isReference(value)
    )
  )
    ? {
        value: getValueForSelectedValue(settings, selectedValue, value, {
          findOption
        })
      }
    : null
}

interface SelectedValueOptions {
  hasOptions: boolean
  findOption(value: any): any
}

function shouldSetTemporaryId(settings: OptionsSettings, option: any) {
  return settings.relate && isObject(option) && option.id == null
}
