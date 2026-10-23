import {
  computed,
  type ComputedRef,
  type Ref,
  type WritableComputedRef
} from 'vue'
import {
  debounceAsync,
  isArray,
  isFunction,
  isObject,
  isString
} from '@ditojs/utils'
import { getMultipleValue } from '../utils/schema/data.js'
import { hasViewSchema } from '../utils/schema/lookup.js'
import {
  findOptionForValue,
  getLabelForOption,
  getOptionLabel,
  getOptionsSettings,
  getSelectedValue,
  getValueForOption,
  getValueForSelectedValue,
  groupOptions,
  type OptionsSettings
} from '../utils/schema/options.ts'
import type { DataSchemaResolver } from '../utils/DataSchemaResolver.js'
import type { Context } from '../utils/schema/types.ts'
import type { Field, FieldProps } from './useField.ts'

export interface OptionsOptions {
  multiple?: Readonly<Ref<boolean>>
  // Options to add unless they're loaded already, like added tags:
  addedOptions?: Readonly<Ref<any[]>>
  // The options of a search, active while set:
  searchedOptions?: Readonly<Ref<any[] | null>>
}

export function useOptions(
  props: FieldProps,
  { value, context, createContext, services, getSchemaValue }: Field,
  {
    multiple = computed(() => getMultipleValue(props.schema, context)),
    addedOptions,
    searchedOptions
  }: OptionsOptions = {}
) {
  // The data model loads the options and shares them with the form:
  const optionsResolver = computed<DataSchemaResolver>(() => {
    const { schema, data, dataPath } = props
    return services.dataContext!.model.getOptionsResolver({
      schema,
      data,
      name: schema.name,
      dataPath
    })
  })

  const optionGroup = computed<string | ((context: Context) => any) | null>(
    () =>
      getSchemaValue(['options', 'group'], {
        type: [String, Function],
        default: null
      })
  )
  const isGrouped = computed(() => !!optionGroup.value)

  const loadedOptions = computed(() => {
    const options = optionsResolver.value.value ?? []
    if (!isArray(options)) {
      throw new Error(`Invalid options data, should be array: ${options}`)
    }
    const group = optionGroup.value
    return group
      ? groupOptions(options, option =>
          isString(group)
            ? option[group]
            : group(createContext({ option }))
        )
      : options
  })

  const settings = computed<OptionsSettings>(() =>
    getOptionsSettings(
      props.schema,
      searchedOptions?.value || loadedOptions.value,
      {
        multiple: multiple.value,
        isGrouped: isGrouped.value,
        createContext
      }
    )
  )

  const isOptionAmong = (option: any, options: any[]) => {
    const value = getValueForOption(settings.value, option)
    return options.some(
      other => getValueForOption(settings.value, other) === value
    )
  }

  const options = computed<any[]>(() => {
    const options = loadedOptions.value
    // Grouped options have no group to add options to:
    const added =
      addedOptions && !isGrouped.value
        ? addedOptions.value.filter(option => !isOptionAmong(option, options))
        : []
    return added.length > 0 ? [...options, ...added] : options
  })

  const activeOptions = computed(() => searchedOptions?.value || options.value)
  const hasOptions = computed(() => activeOptions.value.length > 0)

  // Options filtered out by a search are still options of the value:
  const findOption = (value: any) => (
    findOptionForValue(settings.value, activeOptions.value, value) ?? (
      activeOptions.value !== options.value
        ? findOptionForValue(settings.value, options.value, value)
        : undefined
    )
  )

  // Plain value options are their own values:
  const getOptionForValue = (value: any) =>
    settings.value.optionValue ? findOption(value) : value

  // Values without options get an option that holds them as value and label.
  // Related objects are their own options:
  const getFallbackOption = (value: any) => {
    const { optionValue } = settings.value
    return isObject(value) || !isString(optionValue)
      ? value
      : {
          [optionValue]: value,
          ...(isString(optionLabel.value) && {
            [optionLabel.value]: `${value}`
          })
        }
  }

  const selectedValue = computed({
    get() {
      return getSelectedValue(settings.value, value.value)
    },

    set(selectedValue) {
      value.value = getValueForSelectedValue(
        settings.value,
        selectedValue,
        value.value,
        { findOption }
      )
    }
  })

  const isSelected = (option: any) => {
    const value = getValueForOption(settings.value, option)
    const selected = selectedValue.value
    return multiple.value && isArray(selected)
      ? selected.includes(value)
      : selected === value
  }

  const optionLabel = computed(() =>
    getOptionLabel(props.schema, activeOptions.value, {
      isGrouped: isGrouped.value,
      context
    })
  )

  return {
    optionsResolver,
    isLoadingOptions: computed(() => optionsResolver.value.isLoading),
    options,
    activeOptions,
    hasOptions,
    multiple,
    relate: computed(() => !!props.schema.relate),
    isGrouped,
    optionLabel,
    optionValue: computed(() => settings.value.optionValue),

    searchFilter: computed(() => {
      const search = getSchemaValue('search', {
        type: [Object, Function],
        default: null
      })
      if (search) {
        const { filter, debounce } = isFunction(search)
          ? { filter: search }
          : search
        const searchFilter = debounce ? debounceAsync(filter, debounce) : filter
        return (searchTerm: string) =>
          searchFilter(createContext({ searchTerm }))
      }
      return null
    }),

    editable: computed(
      () => (
        getSchemaValue('editable', { type: Boolean, default: false }) &&
        hasViewSchema(props.schema, context)
      )
    ),

    selectedValue,
    isSelected,

    getValueForOption(option: any) {
      return getValueForOption(settings.value, option)
    },

    getOptionForValue,
    getFallbackOption,
    findOptionForValue: findOption,

    getLabelForOption(option: any) {
      return getLabelForOption(optionLabel.value, option, () =>
        createContext({ option, isSelected: isSelected(option) })
      )
    }
  }
}
