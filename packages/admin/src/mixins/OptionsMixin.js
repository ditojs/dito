import LoadingMixin from './LoadingMixin'
import { getItemParams } from '@/utils/data'
import {
  isObject, isArray, isFunction, isPromise, labelize
} from '@ditojs/utils'

// @vue/component
export default {
  mixins: [LoadingMixin],

  data() {
    return {
      resolvedData: null,
      hasOptions: false
    }
  },

  computed: {
    selectValue: {
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
          this.selectValue = value
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

    options() {
      let data = this.resolvedData
      if (!data) {
        const { options = {} } = this.schema
        data = isObject(options) ? options.data : options
        if (isFunction(data)) {
          // Only evaluate the function once `this.rootData` is available.
          data = this.rootData && data.call(this, getItemParams(this))
        }
        if (isArray(data)) {
          this.hasOptions = true
        } else if (isPromise(data)) {
          // If the data is asynchronous, we can't return it straight away.
          // But we can "cheat" using computed properties and `resolvedData`,
          // which is going to receive the loaded data asynchronously,
          // triggering a recompute of `options` which depends on its value.
          this.setLoading(true)
          data
            .then(data => {
              this.setLoading(false)
              this.resolvedData = data
              this.hasOptions = true
            })
            .catch(error => {
              this.setLoading(false)
              this.addError(error.message, false)
              this.resolvedData = []
            })
          // Clear until promise is resolved.
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
        isObject(this.options[0]) && 'label' ||
        null
    },

    optionValue() {
      // If no `label` was provided but the options are objects, assume a
      // default value of 'value':
      return this.schema.options.value ||
        this.relate && 'id' ||
        isObject(this.options[0]) && 'value' ||
        null
    },

    searchFilter() {
      return this.schema.options.search
    },

    dataProcessor() {
      // Convert object to a shallow copy with only id.
      const processRelate = data => data ? { id: data.id } : data
      return this.relate
        // Selected options can be both objects & arrays, e.g. TypeCheckboxes:
        ? value => isArray(value)
          ? value.map(entry => processRelate(entry))
          : processRelate(value)
        : null
    }
  },

  methods: {
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
        : labelize(option)
    }
  }
}
