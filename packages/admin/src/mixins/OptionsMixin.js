import LoadingMixin from './LoadingMixin'
import TypeMixin from './TypeMixin'
import { isObject, isArray, isFunction, isPromise } from '@ditojs/utils'

export default {
  mixins: [LoadingMixin],

  data() {
    return {
      resolvedValues: null
    }
  },

  computed: {
    selectValue: {
      get() {
        const convert = value => this.relate
          ? this.optionToValue(value)
          : value
        const value = isArray(this.value)
          ? this.value.map(convert)
          : convert(this.value)
        if (this.relate && this.hasOptions() &&
            this.formComponent.isReference(this.value)) {
          // When relating, and as soon as the options are available, replace
          // the original, shallow value with its option version, so that it'll
          // hold actualy data, not just an reference id.
          this.selectValue = value
        }
        return value
      },

      set(value) {
        const convert = value => this.relate
          ? this.valueToOption(value)
          : value
        this.value = isArray(value)
          ? value.map(convert)
          : convert(value)
      }
    },

    options() {
      let values = this.resolvedValues
      if (!values) {
        const { options = {} } = this.schema
        values = isObject(options) ? options.values : options
        if (isFunction(values)) {
          const rootData = this.rootFormComponent.data
          values = rootData &&
            values.call(this, this.data, rootData, this.dataPath)
        }
        if (isPromise(values)) {
          // If the values are asynchronous, we can't return them straight away.
          // But we can "cheat" using computed properties and `resolvedValues`,
          // which is going to receive the loaded data asynchronously,
          // triggering a recompute of `options` which depends on its value.
          this.setLoading(true)
          values
            .then(values => {
              this.setLoading(false)
              this.resolvedValues = values
            })
            .catch(error => {
              this.setLoading(false)
              this.addError(error.message)
            })
          // Use an empty array for now, until resolved.
          values = []
        }
      }
      return this.processOptions(values)
    },

    groupBy() {
      return this.schema.options.groupBy
    },

    relate() {
      return this.schema.options.relate
    },

    optionLabelKey() {
      // If no labelKey was provided but the options are objects, assume a
      // default value of 'label':
      return this.schema.options.labelKey ||
        isObject(this.options[0]) && 'label' ||
        null
    },

    optionValueKey() {
      // If no valueKey was provided but the options are objects, assume a
      // default value of 'value':
      return this.schema.options.valueKey ||
        this.relate && 'id' ||
        isObject(this.options[0]) && 'value' ||
        null
    },

    groupLabelKey() {
      return this.groupBy && 'name' || null
    },

    groupOptionsKey() {
      return this.groupBy && 'options' || null
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
          options = this.groupOptions(options)
        }
      }
      return options
    },

    groupOptions(options) {
      const grouped = {}
      return options.reduce(
        (results, option) => {
          const name = option[this.groupBy]
          let entry = grouped[name]
          if (!entry) {
            entry = grouped[name] = {
              [this.groupLabelKey]: name,
              [this.groupOptionsKey]: []
            }
            results.push(entry)
          }
          entry.options.push(option)
          return results
        },
        []
      )
    },

    findOption(options, value, groupBy = this.groupBy) {
      // Search for the option object with the given value and return the
      // whole object.
      for (const option of options) {
        if (groupBy) {
          const found = this.findOption(option.options, value, null)
          if (found) {
            return found
          }
        } else if (value === this.optionToValue(option)) {
          return option
        }
      }
    },

    valueToOption(value) {
      return this.optionValueKey
        ? this.findOption(this.options, value)
        : value
    },

    optionToValue(option) {
      // When changes happen, store the mapped value instead of full object.
      return this.optionValueKey
        ? option?.[this.optionValueKey]
        : option
    },

    optionToLabel(option) {
      return this.optionLabelKey
        ? option?.[this.optionLabelKey]
        : option
    },

    processPayload(data, dataPath) {
      if (this.relate) {
        // Convert object to a shallow copy with only id.
        const processRelate = data => data ? { id: data.id } : data
        // Selected options can be both objects and arrays, e.g. TypeCheckboxes:
        data = isArray(data)
          ? data.map(entry => processRelate(entry))
          : processRelate(data)
      }
      return TypeMixin.methods.processPayload.call(this, data, dataPath)
    }
  }
}
