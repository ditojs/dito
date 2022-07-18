import DitoContext from '../DitoContext.js'
import DataMixin from './DataMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { setTemporaryId, isReference } from '../utils/data.js'
import {
  isObject, isArray, isString, isFunction,
  normalizeDataPath, labelize, debounceAsync
} from '@ditojs/utils'

// @vue/component
export default {
  mixins: [DataMixin],

  data() {
    return {
      hasOptions: false
    }
  },

  computed: {
    selectedValue: {
      get() {
        const convertValue = value => this.relate
          ? this.hasOption(value)
            ? this.getValueForOption(value)
            : null
          : value
        const value = isArray(this.value)
          ? this.value.map(convertValue).filter(value => value !== null)
          : convertValue(this.value)
        if (
          // When relating and as soon as the options are available...
          this.relate && this.hasOptions && (
            // ...if the value is forced to null because a disappeared option...
            value === null && this.value !== null ||
            // ...or if the value is a reference, replace it with its option
            // value, so that it'll hold actual data, not just a reference id.
            isReference(this.value)
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
      const data = this.handleDataSchema(this.schema.options, 'options', {
        resolveCounter: 1
      }) ?? []
      if (!isArray(data)) {
        throw new Error(`Invalid options data, should be array: ${data}`)
      }
      this.hasOptions = data.length > 0
      return this.processOptions(data)
    },

    activeOptions() {
      // This is overridden in `TypeMultiselect` to return the `searchedOptions`
      // when a search filter was applied.
      return this.options
    },

    relate: getSchemaAccessor('relate', {
      // TODO: Convert to `relateBy: 'id'`
      type: Boolean,
      default: false,
      // We cannot use schema accessor callback magic for `relate` as we need
      // this outside of the component's life-span, see `processData()` below.
      callback: false
    }),

    groupBy: getSchemaAccessor('groupBy', {
      type: String,
      default: null
    }),

    optionLabel: getSchemaAccessor('options.label', {
      type: [String, Function],
      default: null,
      get(label) {
        // If no `label` was provided but the options are objects, assume a
        // default value of 'label':
        return (
          label ||
          this.getOptionKey('label') ||
          null
        )
      }
    }),

    optionValue: getSchemaAccessor('options.value', {
      type: [String, Function],
      default: null,
      get(value) {
        // If no `label` was provided but the options are objects, assume a
        // default value of 'value':
        return (
          value ||
          this.relate && 'id' ||
          this.getOptionKey('value') ||
          null
        )
      }
    }),

    // TODO: Consider moving search to `options.search`?
    searchFilter: getSchemaAccessor('search', {
      type: [Object, Function],
      default: null,
      get(search) {
        if (search) {
          const { filter, debounce } = isFunction(search)
            ? { filter: search }
            : search
          return debounce ? debounceAsync(filter, debounce) : filter
        }
      }
    }),

    groupByLabel() {
      return this.groupBy ? 'label' : null
    },

    groupByOptions() {
      return this.groupBy ? 'options' : null
    }
  },

  methods: {
    getOptionKey(key) {
      const [option] = this.activeOptions
      return isObject(option) && key in option ? key : null
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
              setTemporaryId(option, 'id')
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
        ? findOption(this.activeOptions, value, this.groupBy)
        : value
    },

    getValueForOption(option) {
      const { optionValue } = this
      return isString(optionValue)
        ? option?.[optionValue]
        : isFunction(optionValue)
          ? optionValue.call(this, new DitoContext(this, { option }))
          : option
    },

    getLabelForOption(option) {
      const { optionLabel } = this
      return isString(optionLabel)
        ? option?.[optionLabel]
        : isFunction(optionLabel)
          ? optionLabel.call(this, new DitoContext(this, { option }))
          : labelize(`${option}`)
    }
  },

  processValue(schema, value, dataPath, graph) {
    if (schema.relate) {
      // For internally relating data (`schema.options.dataPath`), we need to
      // process both the options (for '#ref') and the value ('#id').
      // See `DataMixin.handleDataSchema()`:
      const path = schema.options?.dataPath
      const relatedDataPath = path
        ? normalizeDataPath(`${dataPath}/${path}`)
        : null
      graph.addRelation(dataPath, relatedDataPath, schema)
      if (relatedDataPath) {
        graph.setSourceRelated(relatedDataPath)
      }
      // Convert relating objects to a shallow copy with only the id left.
      // TODO: Convert to using `relateBy`:
      const processRelate = value => value ? { id: value.id } : value
      // Selected options can be both objects & arrays, e.g. 'checkboxes':
      value = isArray(value)
        ? value.map(processRelate)
        : processRelate(value)
    }
    return value
  }
}
