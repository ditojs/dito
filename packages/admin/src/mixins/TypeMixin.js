import ValidationMixin from './ValidationMixin'
import { getSchemaAccessor } from '@/utils/accessor'
import { getItemParams, getItem, getParentItem } from '@/utils/data'
import { isFunction, asArray } from '@ditojs/utils'

// @vue/component
export default {
  mixins: [ValidationMixin],

  inject: [
    'tabComponent'
  ],

  props: {
    schema: { type: Object, required: true },
    // NOTE: While `dataPath` points to the actual `value`, `data` represents
    // the `item` in which the `value` is contained, under the key `name`.
    dataPath: { type: String, required: true },
    dataPathIsValue: { type: Boolean, default: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      focused: false
    }
  },

  computed: {
    name() {
      return this.schema.name
    },

    type() {
      return this.schema.type
    },

    value: {
      get() {
        const { compute, format } = this.schema
        if (compute) {
          const value = compute.call(
            this,
            // Override value to prevent endless recursion through calling the
            // getter for `this.value` in `getItemParams()`:
            getItemParams(this, { value: this.data[this.name] })
          )
          if (value !== undefined) {
            // Trigger setter to update computed value, without calling parse():
            this.$set(this.data, this.name, value)
          }
        }
        // For Vue's change tracking to always work, we need to access the
        // property once it's set (e.g. computed)
        let value = this.data[this.name]
        if (format) {
          value = format.call(this, getItemParams(this, { value }))
        }
        return value
      },

      set(value) {
        const { parse } = this.schema
        if (parse) {
          value = parse.call(this, getItemParams(this, { value }))
        }
        this.$set(this.data, this.name, value)
      }
    },

    label: getSchemaAccessor('label', {
      type: [String, Boolean],
      get(label) {
        return label ?? this.getLabel(this.schema)
      }
    }),

    // The following computed properties are similar to the fields returned by
    // getItemParams(), so that we can access these on `this` as well:
    item() {
      return getItem(this.rootItem, this.dataPath, this.dataPathIsValue)
    },

    parentItem() {
      return getParentItem(this.rootItem, this.dataPath, this.dataPathIsValue)
    },

    rootItem() {
      return this.rootData
    },

    processedItem() {
      // We can only get the processed items through the schemaComponent, but
      // that's not necessarily the item represented by this component.
      // Solution: Find the relative path and the processed sub-item from there:
      const { schemaComponent } = this
      return getItem(
        schemaComponent.processedItem,
        // Get the dataPath relative to the schemaComponent's data:
        this.dataPath.substring(schemaComponent.dataPath.length),
        this.dataPathIsValue
      )
    },

    validations() {
      const validations = { ...this.getValidations() }
      if (this.required) {
        validations.required = true
      }
      // Allow schema to override default rules and add any new ones:
      for (const [key, value] of Object.entries(this.schema.rules || {})) {
        if (value === undefined) {
          delete validations[key]
        } else {
          validations[key] = value
        }
      }
      return validations
    },

    dataProcessor() {
      // Produces a `dataProcessor` closure that can exist without the component
      // still being around, by pulling all required schema settings into the
      // local scope and generating a closure that processes the data.
      // It also supports a 'override' `dataProcessor` property on type
      // components than can provide further behavior.
      const dataProcessor = this.getDataProcessor()
      const { exclude, process } = this.schema
      return (value, name, dataPath, rootData) => {
        let params = null
        const getParams = () => (
          params ||
          (params = getItemParams(null, { value, name, dataPath, rootData }))
        )
        if (
          exclude === true ||
          // Support functions next to booleans for `schema.exclude`:
          isFunction(exclude) && exclude(getParams())
        ) {
          return undefined
        }
        if (dataProcessor) {
          value = dataProcessor(value)
        }
        return process ? process(getParams()) : value
      }
    },

    width: getSchemaAccessor('width', {
      type: [String, Number]
    }),

    visible: getSchemaAccessor('visible', {
      type: Boolean,
      default: true
    }),

    exclude: getSchemaAccessor('exclude', {
      type: Boolean,
      default: false
    }),

    required: getSchemaAccessor('required', {
      type: Boolean,
      default: false
    }),

    // TODO: Move these to a sub-class component used for all input components?
    readonly: getSchemaAccessor('readonly', {
      type: Boolean,
      default: false
    }),

    autofocus: getSchemaAccessor('autofocus', {
      type: Boolean,
      default: false
    }),

    // To be used for selects and inputs only?
    clearable: getSchemaAccessor('clearable', {
      type: Boolean,
      default: false
    }),

    placeholder: getSchemaAccessor('placeholder', {
      type: String
    }),

    autocomplete: getSchemaAccessor('autocomplete', {
      type: String
    }),

    attributes() {
      const { nativeField, textField } = this.$options

      const attributes = {
        disabled: this.disabled
      }

      if (nativeField) {
        attributes.name = this.name
        if (this.label) {
          attributes.title = this.label
        }
        attributes.readonly = this.readonly
        attributes.autofocus = this.autofocus
        if (textField) {
          attributes.placeholder = this.placeholder
          attributes.autocomplete = this.autocomplete
        }
      }
      return attributes
    },

    listeners() {
      return {
        focus: () => this.onFocus(),
        blur: () => this.onBlur(),
        input: () => this.onInput(),
        change: () => this.onChange()
      }
    },

    providesData() {
      // NOTE: This is overridden in ResourceMixin, used by lists.
      return false
    }
  },

  created() {
    this.register(true)
    this.setupSchemaFields()
  },

  destroyed() {
    this.register(false)
  },

  methods: {
    register(add) {
      // Prevent flattened type components from overriding parent data paths
      if (!this.$options.flattenedType) {
        this.schemaComponent.registerComponent(this, add)
        // Install / remove the field events to watch of changes and handle
        // validation flags. `events` is provided by `ValidationMixin.events()`
        this[add ? 'on' : 'off'](this.events)
      }
    },

    // @overridable
    getValidations() {
      return null
    },

    // @overridable
    getDataProcessor() {
      return null
    },

    focus() {
      // Also focus this component's panel in case it's a tab.
      this.tabComponent?.focus()
      const [focus] = asArray(this.$refs.element)
      if (focus) {
        this.$nextTick(() => focus.focus())
      }
    },

    clear() {
      this.value = null
    },

    onFocus() {
      this.focused = true
      this.emitEvent('focus')
    },

    onBlur() {
      this.focused = false
      this.emitEvent('blur')
    },

    onInput() {
      this.emitEvent('input')
    },

    onChange() {
      // Pass `schemaComponent` as parent, so change events can propagate up.
      this.emitEvent('change', { parent: this.schemaComponent })
    }
  }
}
