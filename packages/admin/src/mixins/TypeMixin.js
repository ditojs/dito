import DitoContext from '@/DitoContext'
import ValidationMixin from './ValidationMixin'
import { getSchemaAccessor } from '@/utils/accessor'
import { computeValue } from '@/utils/schema'
import { getItem, getParentItem } from '@/utils/data'
import { isString, asArray } from '@ditojs/utils'

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
    data: { type: [Object, Array], required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    single: { type: Boolean, default: false },
    nested: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      parsedValue: null,
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

    component() {
      return this.resolveTypeComponent(this.schema.component)
    },

    value: {
      get() {
        const value = computeValue(
          this.schema,
          this.data,
          this.name,
          this.dataPath,
          { component: this }
        )
        const { format } = this.schema
        // `schema.format` is only ever called in the life-cycle
        // of the component and thus it's ok to bind it to `this`
        return format
          ? format.call(this, new DitoContext(this, { value }))
          : value
      },

      set(value) {
        const { parse } = this.schema
        // `schema.parse` is only ever called in the life-cycle
        // of the component and thus it's ok to bind it to `this`
        this.parsedValue = parse
          ? parse.call(this, new DitoContext(this, { value }))
          : value
        this.$set(this.data, this.name, this.parsedValue)
      }
    },

    // The following computed properties are similar to `DitoContext`
    // properties, so that we can access these on `this` as well:
    item() {
      return getItem(this.rootItem, this.dataPath, this.nested)
    },

    parentItem() {
      return getParentItem(this.rootItem, this.dataPath, this.nested)
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
        this.dataPath.slice(schemaComponent.dataPath.length),
        this.nested
      )
    },

    label: getSchemaAccessor('label', {
      type: [String, Boolean],
      get(label) {
        return isString(label)
          ? label
          : label !== false && this.$options.generateLabel
            ? this.getLabel(this.schema)
            : null
      }
    }),

    width: getSchemaAccessor('width', {
      type: [String, Number]
    }),

    visible: getSchemaAccessor('visible', {
      type: Boolean,
      default() {
        return this.typeOptions.defaultVisible
      }
    }),

    // TODO: Rename to `excluded` for consistent naming
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
        focus: this.onFocus,
        blur: this.onBlur,
        input: this.onInput,
        change: this.onChange
      }
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

    providesData() {
      // NOTE: This is overridden in ResourceMixin, used by lists.
      return false
    },

    showClearButton() {
      return this.clearable && this.value != null
    }
  },

  created() {
    this._register(true)
    this.setupSchemaFields()
  },

  beforeDestroy() {
    this._register(false)
  },

  methods: {
    _register(add) {
      // Prevent unnested type components from overriding parent data paths
      if (this.nested) {
        this.schemaComponent._registerComponent(this, add)
        // Install / remove the field events to watch of changes and handle
        // validation flags. `events` is provided by `ValidationMixin.events()`
        this[add ? 'on' : 'off'](this.events)
      }
    },

    // @overridable
    getValidations() {
      return null
    },

    focus() {
      // Also focus this component's schema and panel in case it's a tab.
      this.schemaComponent.focus()
      this.tabComponent?.focus()
      const [focus] = asArray(this.$refs.element)
      if (focus) {
        this.$nextTick(() => {
          focus.focus()
          // If the element is disabled, `focus()` will likely not have the
          // desired effect. Use `scrollIntoView()` if available:
          if (this.disabled) {
            (focus.$el || focus).scrollIntoView?.()
          }
        })
      }
    },

    clear() {
      this.value = null
      this.onChange()
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
      this.emitEvent('change', {
        context: this.parsedValue !== undefined
          ? { value: this.parsedValue }
          : null,
        // Pass `schemaComponent` as parent, so change events can propagate up.
        parent: this.schemaComponent
      })
    }
  }
}
