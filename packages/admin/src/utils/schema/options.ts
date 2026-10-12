import { toRaw } from 'vue'
import { asArray, isArray, isFunction, isObject, isString } from '@ditojs/utils'
import { getSchemaValue } from './data.js'
import { createTemporaryId, isReference } from '../data.js'
import type { Context } from './types.ts'
import type { Schema } from '../types.ts'

// How the values of a component with options map to its options, which the
// component and the data model share.
export interface OptionsSettings {
  relate: boolean
  multiple: boolean
  // The key or function of the option's value, `null` for options that are
  // their own values:
  optionValue: string | ((context: Context) => any) | null
  optionEquals: ((context: Context) => boolean) | null
  groupBy: string | null
  createContext(values: Record<string, any>): Context
}

// The settings of `schema` for `options`, which are grouped if `groupBy` is
// set, see `groupOptions()`.
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
  // `relate` is read without callbacks, as values are processed without
  // contexts, see `optionsTraits.processValue()`:
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

// Group the options by the value of their `groupBy` key, as
// `{ label, options }` objects.
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

// `key` if the options are objects that hold it, looked up in the first group
// of grouped options.
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
    // Until they're selected and get temporary ids, options without ids are
    // their own values, compared by identity, see `getValueForSelectedValue()`.
    return toRaw(option)
  }
  const { optionValue, createContext } = settings
  return isString(optionValue)
    ? (option?.[optionValue] ?? null)
    : isFunction(optionValue)
      ? optionValue(createContext({ option }))
      : option
}

// Find the option with the given value in `options`, matched through
// `optionEquals` if provided, also in grouped options.
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

// The value that the options select for `value`: the value of its
// option with `relate`, and `null` for values without an option, unless there
// are no options. `findOption()` finds the option of a value.
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

// Convert the selected value to the value, e.g. an option to its related
// object with `relate`. `value` holds the related objects without options.
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
    // Keep related objects without options, see `getFallbackOption()` in
    // `DitoTypeMultiselect`:
    const option = (
      findOption(selected) ??
      asArray(value).find(
        (object: any) => getValueForOption(settings, object) === selected
      )
    )
    if (shouldSetTemporaryId(settings, option)) {
      // Options without ids, e.g. new items of the edited data, get temporary
      // ids when selected, so that the relation can reference them when
      // saving, see `SchemaGraph`. The option itself needs the id, as a copy
      // wouldn't propagate.
      option.id = createTemporaryId()
    }
    return option
  }
  return settings.multiple && isArray(selectedValue)
    ? selectedValue.map(convertValue)
    : convertValue(selectedValue)
}

// The value that replaces `value` once the options are there, wrapped
// in an object, or `null` if it stays: Values whose option disappeared become
// `null`, unless the schema is `taggable`, which holds values without options,
// and references become the objects of their options, so that they hold the
// actual data, not just an id.
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

// Whether the option needs a temporary id to be related to, as it has no id
// yet, e.g. a new item of the edited data.
function shouldSetTemporaryId(settings: OptionsSettings, option: any) {
  return settings.relate && isObject(option) && option.id == null
}
