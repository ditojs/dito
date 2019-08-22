import LoadingMixin from './LoadingMixin'
import { getItemParams } from '@/utils/data'
import {
  isObject, isArray, isFunction, isPromise, labelize, debounceAsync
} from '@ditojs/utils'

// @vue/component
export default {
  mixins: [LoadingMixin],

  data() {
    return {
      loadedOptions: null,
      hasOptions: false
    }
  },

  computed: {
    selectedValue: {
      get() {
        const convert = value => this.relate
          ? this.hasOption(value)
            ? this.getValueForOption(value)
            : null
          : value
        const value = isArray(this.value)
          ? this.value.map(convert).filter(value => value !== null)
          : convert(this.value)
        if (
          // When relating and as soon as the options are available...
          this.relate && this.hasOptions && (
            // ...if the value is forced to null because a disappeared option...
            value === null && this.value !== null ||
            // ...or if the value is a reference, replace it with its option
            // value, so that it'll hold actual data, not just a reference id.
            this.schemaComponent.isReference(this.value)
          )
        ) {
          this.selectedValue = value
        }
        return value
      },

      set(value) {
        const convert = value => this.relate
          ? this.getOptionForValue(value)
          : value
        this.value = isArray(value)
          ? value.map(convert)
          : convert(value)
      }
    },

    selectedOption() {
      return this.getOptionForValue(this.selectedValue)
    },

    options() {
      let data = this.loadedOptions
      if (!data) {
        const { options = {} } = this.schema
        data = isObject(options) ? options.data : options
        if (isFunction(data)) {
          data = data.call(this, getItemParams(this))
        }
        if (isArray(data)) {
          this.hasOptions = true
        } else if (isPromise(data)) {
          // If the data is asynchronous, we can't return it straight away.
          // But we can "cheat" using computed properties and `loadedOptions`,
          // which is going to receive the loaded data asynchronously,
          // triggering a recompute of `options` which depends on its value.
          this.loadOptions(() => data).then(options => {
            this.loadedOptions = options || []
            this.hasOptions = !!options
          })
          // Clear data until promise is resolved and `loadedOptions` is set.
          data = null
        }
      }
      return this.processOptions(data || [])
    },

    relate() {
      return this.schema.relate
    },

    groupBy() {
      return this.schema.options.groupBy
    },

    groupByLabel() {
      return this.groupBy && 'label' || null
    },

    groupByOptions() {
      return this.groupBy && 'options' || null
    },

    optionLabel() {
      // If no `label` was provided but the options are objects, assume a
      // default value of 'label':
      return this.schema.options.label ||
        this.getOptionKey('label') ||
        null
    },

    optionValue() {
      // If no `label` was provided but the options are objects, assume a
      // default value of 'value':
      return this.schema.options.value ||
        this.relate && 'id' ||
        this.getOptionKey('value') ||
        null
    },

    searchFilter() {
      const { search, options } = this.schema
      if (search) {
        const { filter, debounce } = isFunction(search)
          ? { filter: search }
          : search
        return debounce ? debounceAsync(filter, debounce) : filter
      } else {
        // TODO: `schema.options.search` is deprecated, remove later.
        return options.search
      }
    }
  },

  methods: {
    getDataProcessor() {
      // Convert object to a shallow copy with only id.
      const processRelate = data => data ? { id: data.id } : data
      return this.relate
        // Selected options can be both objects & arrays, e.g. TypeCheckboxes:
        ? value => isArray(value)
          ? value.map(entry => processRelate(entry))
          : processRelate(value)
        : null
    },

    getOptionKey(key) {
      const [option] = this.options
      return isObject(option) && key in option ? key : null
    },

    async loadOptions(load, settings) {
      this.setLoading(true, settings)
      let options = null
      try {
        options = await load()
      } catch (error) {
        this.addError(error.message || error)
      }
      this.setLoading(false, settings)
      return options
    },

    processOptions(options) {
      if (options.length) {
        if (this.relate) {
          // If ids are missing and we want to relate, set temporary ids.
          // NOTE: We need to modify the actual data, making a copy won't work
          // as it won't propagate.
          // NOTE: This only makes sense if the data is from the graph that
          // we're currently editing.
          for (const option of options) {
            if (!('id' in option)) {
              this.schemaComponent.setTemporaryId(option)
            }
          }
        }
        if (this.groupBy) {
          const grouped = {}
          options = options.reduce(
            (results, option) => {
              const group = option[this.groupBy]
              let entry = grouped[group]
              if (!entry) {
                entry = grouped[group] = {
                  [this.groupByLabel]: group,
                  [this.groupByOptions]: []
                }
                results.push(entry)
              }
              entry.options.push(option)
              return results
            },
            []
          )
        }
      }
      return options
    },

    hasOption(option) {
      return !!this.getOptionForValue(this.getValueForOption(option))
    },

    getOptionForValue(value) {
      const findOption = (options, value, groupBy) => {
        // Search for the option object with the given value and return the
        // whole object.
        for (const option of options) {
          if (groupBy) {
            const found = findOption(option.options, value, null)
            if (found) {
              return found
            }
          } else if (value === this.getValueForOption(option)) {
            return option
          }
        }
      }

      return this.optionValue
        ? findOption(this.options, value, this.groupBy)
        : value
    },

    getValueForOption(option) {
      return this.optionValue
        ? option?.[this.optionValue]
        : option
    },

    getLabelForOption(option) {
      return isFunction(this.optionLabel)
        ? this.optionLabel(option)
        : this.optionLabel ? option?.[this.optionLabel]
        : labelize(`${option}`)
    }
  }
}
