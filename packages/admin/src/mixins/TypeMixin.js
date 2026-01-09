import ValueMixin from './ValueMixin.js'
import ContextMixin from './ContextMixin.js'
import ValidationMixin from './ValidationMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { asArray, camelize } from '@ditojs/utils'

// @vue/component
export default {
  mixins: [ValueMixin, ContextMixin, ValidationMixin],
  emits: ['update:component'],

  props: {
    schema: { type: Object, required: true },
    // NOTE: While `dataPath` points to the actual `value`, `data` represents
    // the `item` in which the `value` is contained, under the key `name`.
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    width: { type: [Number, String], default: null },
    label: { type: String, default: null },
    single: { type: Boolean, default: false },
    nested: { type: Boolean, default: true },
    accumulatedBasis: { type: Number, default: null }
  },

  data() {
    return {
      parsedValue: undefined,
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

    labelNode() {
      const node = this.isMounted ? this.$el.previousElementSibling : null
      return node?.matches('.dito-label') ? node : null
    },

    visible: getSchemaAccessor('visible', {
      type: Boolean,
      default() {
        return this.$options.defaultVisible
      }
    }),

    // TODO: Rename to `excluded` for consistent naming?
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
      default: false,

      get(clearable) {
        return clearable && !this.readonly
      }
    }),

    disabled: getSchemaAccessor('disabled', {
      type: Boolean,
      default: false
    }),

    maxLength: getSchemaAccessor('maxLength', {
      type: Number
    }),

    placeholder: getSchemaAccessor('placeholder', {
      type: String
    }),

    autocomplete: getSchemaAccessor('autocomplete', {
      type: String
    }),

    events() {
      const events = this.getEvents()
      // Register callbacks for all provides non-recognized events,
      // assuming they are native events.
      // TODO: Move to vue3-style `on[A-Z]` event handlers naming that aren't
      // namespaced in `schema.events` once the transition is complete.
      for (const event of Object.keys(this.schema.events || {})) {
        events[`on${camelize(event, true)}`] ??= () => {
          this.emitEvent(event)
        }
      }
      return events
    },

    attributes() {
      const { nativeField, textField } = this.$options

      const attributes = {
        ...this.events,
        disabled: this.disabled
      }

      if (nativeField) {
        attributes.name = this.dataPath
        if (this.label) {
          attributes.title = this.label
        }
        attributes.readonly = this.readonly
        attributes.autofocus = this.autofocus
        if (textField) {
          attributes.maxlength = this.maxLength
          attributes.placeholder = this.placeholder
          attributes.autocomplete = this.autocomplete
        }
      }

      return attributes
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

    showClearButton() {
      return this.clearable && this.value != null
    }
  },

  created() {
    this._register(true)
    this.setupSchemaFields()
  },

  unmounted() {
    this._register(false)
  },

  methods: {
    _register(add) {
      // Provide component to container for schema accessor evaluation.
      this.$emit('update:component', add ? this : null)
      // Prevent unnested type components from overriding parent data paths
      if (this.nested) {
        this.schemaComponent._registerComponent(this, add)
      }
    },

    // @overridable
    getEvents() {
      const { onFocus, onBlur, onInput, onChange } = this
      return { onFocus, onBlur, onInput, onChange }
    },

    // @overridable
    getValidations() {
      return null
    },

    // @overridable
    async scrollIntoView() {
      await this.focusSchema()
      this.getFocusElement()?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center'
      })
    },

    // @overridable
    focusElement() {
      this.getFocusElement()?.focus?.()
    },

    // @overridable
    blurElement() {
      this.getFocusElement()?.blur?.()
    },

    getFocusElement() {
      const element = asArray(this.$refs.element)[0] ?? this
      return element.$el ?? element
    },

    async focusSchema() {
      // Also focus this component's schema and panel in case it's a tab.
      await this.schemaComponent.focus()
      await this.tabComponent?.focus()
    },

    async focus() {
      await this.focusSchema()
      this.scrollIntoView()
      this.focusElement()
    },

    blur() {
      this.blurElement()
    },

    clear() {
      this.value = null
      this.blur()
      this.onChange()
    },

    onFocus() {
      this.focused = true
      this.markTouched()
      this.emitEvent('focus')
    },

    onBlur() {
      this.focused = false
      this.validate()
      this.emitEvent('blur')
    },

    onInput() {
      this.markDirty()
      this.emitEvent('input')
    },

    onChange() {
      this.markDirty()
      this.emitEvent('change', {
        context: {
          // Prevent endless parse recursion:
          value: this.parsedValue !== undefined ? this.parsedValue : this.value
        },
        // Pass `schemaComponent` as parent, so change events can propagate up.
        parent: this.schemaComponent
      })
    }
  }
}
