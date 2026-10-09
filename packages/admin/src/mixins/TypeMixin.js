import ValueMixin from './ValueMixin.js'
import ContextMixin from './ContextMixin.js'
import ValidationMixin from './ValidationMixin.js'
import { getSchemaEventEntries } from './DitoMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { trackRegistration } from '../utils/registration.js'
import { getValidations } from '../utils/schema/validation.js'
import { asArray, camelize, equals } from '@ditojs/utils'

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
    // The id of the element that displays the errors, see `DitoContainer`.
    errorsElementId: { type: String, default: null }
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

    info: getSchemaAccessor('info', {
      type: String,
      default: null
    }),

    events() {
      const events = this.getEvents()
      // Register callbacks for all events that the schema handles and that the
      // component doesn't handle itself, assuming they are native events, in
      // both forms, `events: { mouseenter }` and `onMouseenter`.
      for (const { event } of getSchemaEventEntries(this.schema)) {
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
        // Only text fields support `readonly`, disable all other components.
        'disabled': this.disabled || (this.readonly && !textField),
        // Link the displayed errors for assistive technology:
        'aria-invalid': this.hasErrors || null,
        'aria-describedby': this.hasErrors ? this.errorsElementId : null
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
      return getValidations(this.schema, this.context)
    }
  },

  watch: {
    value(value) {
      // Displayed errors refer to the value that they were added for, see
      // `addError()`, so they're cleared when the value changes, whether
      // through input or by code, e.g. by a button that generates a value.
      // Errors that were added for the new value already, e.g. by `validate()`
      // on blur right after the change, are kept.
      if (this.hasErrors && !equals(value, this.valueWithErrors)) {
        this.clearErrors()
      }
    }
  },

  created() {
    // Provide component to container for schema accessor evaluation.
    this.$emit('update:component', this)
    this._unregister = trackRegistration(
      this,
      this._registerWithSchemaComponent
    )
    this.setupSchemaFields()
    this.warnAboutUncomputedValue()
  },

  unmounted() {
    this.$emit('update:component', null)
    this._unregister()
  },

  methods: {
    // Only the data model calls `compute()`, see `computeValue()`. Components
    // that it doesn't visit, e.g. in panels with their own data, never get
    // their values computed.
    warnAboutUncomputedValue() {
      if (
        this.schema.compute &&
        !this.dataModel.hasComputedValueEntry(this.componentPath)
      ) {
        console.warn(
          `The value of the component at '${this.componentPath}' isn't ` +
          `computed, as its data isn't part of a data model.`
        )
      }
    },

    _registerWithSchemaComponent(add, componentPath) {
      // Register unnested type components separately, to prevent them from
      // overriding parent data paths.
      if (this.nested) {
        this.schemaComponent._registerComponent(this, add, componentPath)
      } else {
        this.schemaComponent?._registerUnnestedComponent(
          this,
          add,
          componentPath
        )
      }
    },

    // @overridable
    getEvents() {
      const { onFocus, onBlur, onInput, onChange } = this
      return { onFocus, onBlur, onInput, onChange }
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
      this._getFocusTarget('focus')?.focus?.()
    },

    // @overridable
    blurElement() {
      this._getFocusTarget('blur')?.blur?.()
    },

    _getFocusTarget(method) {
      // Prefer the `focus()` and `blur()` of components, e.g. `DitoInput`
      // targets its input rather than its root element that
      // `getFocusElement()` returns.
      const element = asArray(this.$refs.element)[0]
      return element?.[method] ? element : this.getFocusElement()
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
