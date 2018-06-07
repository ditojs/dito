import LoadingMixin from './LoadingMixin'
import TypeMixin from './TypeMixin'
import { isObject, isArray, isFunction, isPromise } from '@ditojs/utils'

export default {
  mixins: [LoadingMixin],

  data() {
    return {
      resolvedData: null
    }
  },

  computed: {
    selectValue: {
      get() {
        const convert = value => this.relate
          ? this.getValueForOption(value)
          : value
        const value = isArray(this.value)
          ? this.value.map(convert)
          : convert(this.value)
        if (this.relate && this.hasOptions() &&
            this.formComponent.isReference(this.value)) {
          // When relating, and as soon as the options are available, replace
          // the original, shallow value with its option version, so that it'll
          // hold actually data, not just an reference id.
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
          const { rootData } = this
          data = rootData &&
            data.call(this, this.data, rootData, this.dataPath)
        }
        if (isPromise(data)) {
          // If the data is asynchronous, we can't return it straight away.
          // But we can "cheat" using computed properties and `resolvedData`,
          // which is going to receive the loaded data asynchronously,
          // triggering a recompute of `options` which depends on its value.
          this.setLoading(true)
          data
            .then(data => {
              this.setLoading(false)
              this.resolvedData = data
            })
            .catch(error => {
              this.setLoading(false)
              this.addError(error.message)
              this.resolvedData = []
            })
          // Use an empty array for now, until resolved.
          data = []
        }
      }
      return this.processOptions(data)
    },

    relate() {
      return this.schema.options.relate
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
      // If no valueKey was provided but the options are objects, assume a
      // default value of 'value':
      return this.schema.options.value ||
        this.relate && 'id' ||
        isObject(this.options[0]) && 'value' ||
        null
    }
  },

  methods: {
    hasOptions() {
      return this.options.length > 0
    },

    processOptions(options = []) {
      if (options.length) {
        if (this.relate) {
          // If ids are missing and we want to relate, set temporary ids.
          // NOTE: We need to modify the actual data, making a copy won't work
          // as it won't propagate.
          // NOTE: This only makes sense if the data is from the graph that
          // we're currently editing.
          for (const option of options) {
            if (!('id' in option)) {
              this.formComponent.setTemporaryId(option)
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
        : option
    },

    processValue(value, dataPath) {
      if (this.relate) {
        // Convert object to a shallow copy with only id.
        const processRelate = data => data ? { id: data.id } : data
        // Selected options can be both objects and arrays, e.g. TypeCheckboxes:
        value = isArray(value)
          ? value.map(entry => processRelate(entry))
          : processRelate(value)
      }
      return TypeMixin.methods.processValue.call(this, value, dataPath)
    }
  }
}
