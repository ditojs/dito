import DitoContext from '../DitoContext.js'
import DataMixin from './DataMixin.js'
import {
  hasViewSchema,
  getViewEditPath,
  getMultipleValue
} from '../utils/schema.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { setTemporaryId, isReference } from '../utils/data.js'
import {
  isObject,
  isArray,
  isString,
  isFunction,
  normalizeDataPath,
  labelize,
  debounceAsync
} from '@ditojs/utils'

// @vue/component
export default {
  mixins: [DataMixin],

  computed: {
    // @overridable
    multiple() {
      return getMultipleValue(this.schema)
    },

    selectedValue: {
      get() {
        const convertValue = value => {
          const val = this.relate
            ? this.getValueForOption(value)
            : value

          return this.hasOptions
            ? this.getOptionForValue(val)
              ? val
              : null
            : value
        }

        const value =
          this.multiple && isArray(this.value)
            ? this.value.map(convertValue).filter(value => value !== null)
            : convertValue(this.value)

        if (
          // As soon as the options are available, and...
          this.hasOptions && (
            // ...if the value is forced to null because a disappeared option...
            value === null && this.value !== null ||
            // ...or if the value is a reference, replace it with its option
            // value, so that it'll hold actual data, not just a reference id.
            isReference(this.value)
          )
        ) {
          // TODO: Fix side-effects
          // eslint-disable-next-line vue/no-side-effects-in-computed-properties
          this.selectedValue = value
        }
        return value
      },

      set(value) {
        const convertValue = value =>
          this.relate
            ? this.getOptionForValue(value)
            : value

        this.value =
          this.multiple && isArray(value)
            ? value.map(convertValue)
            : convertValue(value)
      }
    },

    selectedOption() {
      return this.getOptionForValue(this.selectedValue)
    },

    options() {
      const data = this.handleDataSchema(this.schema.options, 'options') ?? []
      if (!isArray(data)) {
        throw new Error(`Invalid options data, should be array: ${data}`)
      }
      return this.processOptions(data)
    },

    activeOptions() {
      // This is overridden in `TypeMultiselect` to return the `searchedOptions`
      // when a search filter was applied.
      return this.options
    },

    hasOptions() {
      return this.activeOptions.length > 0
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

    // TODO: Rename to `options.labelKey` / `optionLabelKey`?
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

    // TODO: Rename to `options.valueKey` / `optionValueKey`?
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

    optionEquals: getSchemaAccessor('options.equals', {
      type: Function,
      default: null
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

    editable: getSchemaAccessor('editable', {
      type: Boolean,
      default: false,
      get(editable) {
        return (
          editable &&
          hasViewSchema(this.schema, this.context)
        )
      }
    }),

    editPath() {
      return this.editable && this.selectedValue
        ? getViewEditPath(this.schema, this.selectedValue, this.context)
        : null
    },

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
              // TODO: Fix side-effects
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
              entry[this.groupByOptions].push(option)
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
          } else {
            const matches = this.optionEquals
              ? this.optionEquals(new DitoContext(this, { value, option }))
              : value === this.getValueForOption(option)
            if (matches) {
              return option
            }
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
        ? option?.[optionValue] ?? null
        : isFunction(optionValue)
          ? optionValue(new DitoContext(this, { option }))
          : option
    },

    getLabelForOption(option) {
      const { optionLabel } = this
      return isString(optionLabel)
        ? option?.[optionLabel]
        : isFunction(optionLabel)
          ? optionLabel(new DitoContext(this, { option }))
          : labelize(`${option}`)
    }
  },

  processValue({ schema, value, dataPath }, graph) {
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
      const processRelate = value => (value ? { id: value.id } : value)
      // Selected options can be both objects & arrays, e.g. 'checkboxes':
      value =
        getMultipleValue(schema) && isArray(value)
          ? value.map(processRelate)
          : processRelate(value)
    }
    return value
  }
}
