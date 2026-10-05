import { toRaw } from 'vue'
import DitoContext from '../DitoContext.js'
import { hasViewSchema, getViewEditPath } from '../utils/schema/lookup.js'
import { getMultipleValue } from '../utils/schema/data.js'
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

        return this.multiple && isArray(this.value)
          ? this.value.map(convertValue).filter(value => value !== null)
          : convertValue(this.value)
      },

      set(value) {
        const convertValue = value => {
          if (!this.relate) {
            return value
          }
          const option = this.getOptionForValue(value)
          if (this.shouldSetTemporaryId(option)) {
            // Options without ids, e.g. new items of the edited data, get
            // temporary ids when selected, so that the relation can reference
            // them when saving, see `SchemaGraph`.
            // NOTE: We need to modify the actual data, making a copy won't
            // work as it won't propagate.
            setTemporaryId(option, 'id')
          }
          return option
        }

        this.value =
          this.multiple && isArray(value)
            ? value.map(convertValue)
            : convertValue(value)
      }
    },

    // Whether the value needs to be replaced with the selected value, once the
    // options are available: if the value is forced to `null` because its
    // option disappeared, or if the value is a reference, so that it'll hold
    // actual data, not just a reference id. See `watch`. Filtered options, e.g.
    // the results of a search, don't tell whether the value's option exists.
    shouldReplaceValueWithSelectedValue() {
      return (
        this.hasOptions &&
        !this.areOptionsFiltered && (
          this.selectedValue === null && this.value !== null ||
          isReference(this.value)
        )
      )
    },

    selectedOption() {
      return this.getOptionForValue(this.selectedValue)
    },

    // The resolver of the options in the data model, which loads them and
    // shares them with the computes of the form. It is looked up with the entry
    // of this component, in the shape of the entries of `processSchemaData()`,
    // see `DataModel`.
    optionsResolver() {
      return this.dataModel.getOptionsResolver({
        schema: this.schema,
        data: this.data,
        name: this.name,
        dataPath: this.dataPath,
        componentPath: this.componentPath
      })
    },

    isLoadingOptions() {
      return this.optionsResolver.isLoading
    },

    options() {
      const options = this.optionsResolver.value ?? []
      if (!isArray(options)) {
        throw new Error(`Invalid options data, should be array: ${options}`)
      }
      return this.groupBy ? this.groupOptions(options) : options
    },

    activeOptions() {
      // This is overridden in `TypeMultiselect` to return the `searchedOptions`
      // when a search filter was applied.
      return this.options
    },

    // Whether the active options are a filtered subset of the options, e.g.
    // the results of a search, see `activeOptions`.
    areOptionsFiltered() {
      return this.activeOptions !== this.options
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

  watch: {
    // Replace the value with the selected value as soon as the options are
    // available, and also when the value changes while it still needs to be
    // replaced, e.g. a relation without value that is set to a reference.
    'shouldReplaceValueWithSelectedValue': {
      handler(shouldReplace) {
        if (shouldReplace) {
          this.replaceValueWithSelectedValue()
        }
      },
      immediate: true
    },

    'value'() {
      if (this.shouldReplaceValueWithSelectedValue) {
        this.replaceValueWithSelectedValue()
      }
    },

    'optionsResolver.lastLoadError'(error) {
      if (error) {
        this.addError(error.message || error)
      }
    }
  },

  methods: {
    getOptionKey(key) {
      const [option] = this.activeOptions
      return isObject(option) && key in option ? key : null
    },

    // Writes the selected value back into the data, through the setter of
    // `selectedValue`, which converts it to the value, e.g. a reference id to
    // its option with `relate`, or a value whose option disappeared to `null`.
    // This is derived from the options, not a change by the user, so it is
    // made as a clean change, which doesn't make the form dirty.
    replaceValueWithSelectedValue() {
      const { selectedValue } = this
      this.dataModel
        .applyCleanChanges(() => {
          this.selectedValue = selectedValue
        })
        .catch(console.error)
    },

    // Groups the options by the `groupBy` key, see `groupByLabel` and
    // `groupByOptions`.
    groupOptions(options) {
      const groups = {}
      return options.reduce(
        (results, option) => {
          const groupName = option[this.groupBy]
          let group = groups[groupName]
          if (!group) {
            group = groups[groupName] = {
              [this.groupByLabel]: groupName,
              [this.groupByOptions]: []
            }
            results.push(group)
          }
          group[this.groupByOptions].push(option)
          return results
        },
        []
      )
    },

    // Whether the option needs a temporary id to be related to, as it has no
    // id yet, e.g. a new item of the edited data. It gets one when selected,
    // see `selectedValue`.
    shouldSetTemporaryId(option) {
      return this.relate && isObject(option) && option.id == null
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

      const { optionValue, groupBy } = this
      return optionValue
        ? (findOption(this.activeOptions, value, groupBy) ??
          // Options filtered out of the active options, e.g. by a search, are
          // still options of the value.
          (
            this.areOptionsFiltered
              ? findOption(this.options, value, groupBy)
              : undefined
          ))
        : value
    },

    getValueForOption(option) {
      if (this.shouldSetTemporaryId(option)) {
        // Until they're selected and get temporary ids, options without ids
        // are their own values, compared by identity, see `selectedValue`.
        return toRaw(option)
      }
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
      // See `DataSchemaResolver`:
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
