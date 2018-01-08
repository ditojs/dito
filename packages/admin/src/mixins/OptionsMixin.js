import axios from 'axios'
import { isObject, isArray, getPath } from '@/utils'

export default {
  data() {
    return {
      // TODO: Allow handling through RouteMixin if required...
      loading: false
    }
  },

  asyncComputed: {
    options() {
      const { options } = this.schema
      if (isObject(options)) {
        const url = options.url ||
          options.apiPath && this.api.baseURL + options.apiPath
        if (url) {
          this.loading = true
          return axios.get(url)
            .then(response => {
              this.loading = false
              return options.groupBy
                ? this.groupBy(response.data, options.groupBy)
                : response.data
            })
            .catch(error => {
              this.loading = false
              this.$errors.add(this.name, error.response?.data || error.message)
              return null
            })
        } else if (options.dataPath) {
          // dataPath uses the json-pointer format to reference data in the
          // dataRoot, meaning the first parent data that isn't nested.
          const { dataPath } = options
          const data = /^[./]/.test(dataPath)
            ? this.dataRoot && getPath(this.dataRoot, dataPath.substr(1))
            : this.data && getPath(this.data, dataPath)
          if (this.schema.options.relate) {
            // If ids are missing and we want to relate, add a temporary id,
            // marked it with a '@' at the beginning.
            if (data) {
              for (const option of data) {
                if (!option.id) {
                  option.id = `@${++temporaryId}`
                }
              }
            }
          }
          return data
        } else {
          // When providing options.labelKey & options.valueKey, options.values
          // can be used to provide the data instead of url.
          return options.values
        }
      } else if (isArray(options)) {
        // Use an array of strings to provide the values be shown and selected.
        return options
      }
    }
  },

  computed: {
    selectValue: {
      get() {
        return this.schema.options.relate
          ? this.optionToValue(this.value)
          : this.value
      },
      set(value) {
        this.value = this.schema.options.relate
          ? this.valueToOption(value)
          : value
      }
    },

    optionLabelKey() {
      // If no labelKey was provided but the options are objects, assume a
      // default value of 'label':
      return this.schema.options.labelKey ||
       isObject(this.options?.[0]) && 'label' || null
    },

    optionValueKey() {
      // If no valueKey was provided but the options are objects, assume a
      // default value of 'value':
      const { options } = this.schema
      return options.valueKey ||
        options.relate && 'id' ||
        isObject(this.options?.[0]) && 'value' ||
        null
    },

    groupLabelKey() {
      return this.schema.options.groupBy && 'name' || null
    },

    groupOptionsKey() {
      return this.schema.options.groupBy && 'options' || null
    }
  },

  methods: {
    getOptionValue(option) {
      return this.optionValueKey ? option[this.optionValueKey] : option
    },

    getOptionLabel(option) {
      return this.optionLabelKey ? option[this.optionLabelKey] : option
    },

    groupBy(options, groupBy) {
      const grouped = {}
      return options.reduce((results, option) => {
        const name = option[groupBy]
        let entry = grouped[name]
        if (!entry) {
          entry = grouped[name] = {
            name, // :group-label, see groupLabelKey()
            options: [] // :group-values, see groupOptionsKey()
          }
          results.push(entry)
        }
        entry.options.push(option)
        return results
      }, [])
    },

    findOption(options, value, groupBy) {
      // Search for the option object with the given value and return the
      // whole object.
      if (options) {
        for (const option of options) {
          if (groupBy) {
            const found = this.findOption(option.options, value, false)
            if (found) {
              return found
            }
          } else if (value === this.getOptionValue(option)) {
            return option
          }
        }
      }
    },

    valueToOption(value) {
      // Convert value to options object, since vue-multiselect can't map that
      // itself unfortunately. `track-by` is used for :key mapping it seems.
      return this.optionValueKey
        ? this.findOption(this.options, value, this.schema.options.groupBy)
        : value
    },

    optionToValue(value) {
      // When changes happend, store the mapped value instead of full object.
      return this.optionValueKey
        ? value?.[this.optionValueKey]
        : value
    }
  }
}

let temporaryId = 0
