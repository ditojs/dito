import LoadingMixin from './LoadingMixin'
import { isObject, isArray, isFunction, isPromise } from '@ditojs/utils'

export default {
  mixins: [LoadingMixin],

  data() {
    return {
      options: []
    }
  },

  watch: {
    'schema.options': 'getOptions'
  },

  created() {
    this.getOptions()
  },

  computed: {
    selectValue: {
      get() {
        const convert = value => this.relate
          ? this.optionToValue(value)
          : value
        return isArray(this.value)
          ? this.value.map(convert)
          : convert(this.value)
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

    async getOptions() {
      const { options = {} } = this.schema
      let values = isObject(options) ? options.values : options
      if (isFunction(values)) {
        values = values.call(
          this, this.data, this.dataFormComponent?.data, this.dataPath
        )
      }
      if (isPromise(values)) {
        this.setLoading(true)
        try {
          values = await values
        } catch (error) {
          values = []
          this.addError(error.message)
        }
        this.setLoading(false)
      }
      this.setOptions(values)
      return values
    },

    setOptions(options = []) {
      if (options.length) {
        if (this.relate) {
          // If ids are missing and we want to relate, add temporary ids,
          // marked it with a '@' at the beginning.
          // NOTE: This only makes sense if the data is from the graph that
          // we're currently editing.
          options = options.map(({ id, ...rest }) => ({
            id: id || `@${++temporaryId}`,
            ...rest
          }))
        }
        if (this.groupBy) {
          options = this.groupOptions(options)
        }
      }
      this.options = options
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
    }
  }
}

let temporaryId = 0
