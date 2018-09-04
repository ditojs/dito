import { isObject, isArray, isFunction } from '@ditojs/utils'
import { getSchemaAccessor } from '@/utils/accessor'
import { getParentItem, getItemParams } from '@/utils/item'

// @vue/component
export default {
  // Inherit the $validator from the parent.
  // See: https://github.com/logaretm/vee-validate/issues/468
  // NOTE: We can't do this in DitoMixin for all components, as it would
  // override the $validates: true` setting there.
  inject: ['$validator'],

  props: {
    schema: { type: Object, required: true },
    // NOTE: While `dataPath` points to the actual `value`, `data` represents
    // the `item` in which the `value` is contained, under the key `name`.
    dataPath: { type: String, required: true },
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

    // Similar to getItemParams(), so we can access these on `this` as well:
    // NOTE: While internally, we speak of `data`, in the API surface, the term
    // `item` is used for the data that relates to editing objects.

    item() {
      return this.data
    },

    rootItem() {
      return this.rootData
    },

    parentItem() {
      return getParentItem(this.rootData, this.dataPath)
    },

    processedItem() {
      return this.schemaComponent.processData({ processIds: true })
    },

    mergedDataProcessor() {
      // Produces a `dataProcessor` closure that can exist without the component
      // still being around, by pulling all required schema settings into the
      // local scope and generating a closure that processes the data.
      // It also supports a 'override' `dataProcessor` property on type
      // components than can provide further behavior.
      const { dataProcessor } = this
      const { exclude, process } = this.schema
      return (value, rootData, dataPath) => {
        if (exclude) {
          return undefined
        }
        if (dataProcessor) {
          value = dataProcessor(value)
        }
        return process
          ? process(getItemParams({ value, rootData, dataPath }))
          : value
      }
    },

    width: getSchemaAccessor('width', { type: [String, Number] }),
    visible: getSchemaAccessor('visible', { type: Boolean }),
    exclude: getSchemaAccessor('exclude', { type: Boolean }),
    required: getSchemaAccessor('required', { type: Boolean }),

    // TODO: Move these to a sub-class component used for all input components?
    readonly: getSchemaAccessor('readonly', { type: Boolean }),
    autofocus: getSchemaAccessor('autofocus', { type: Boolean }),
    placeholder: getSchemaAccessor('placeholder', { type: String }),
    autocomplete: getSchemaAccessor('autocomplete', { type: String }),

    attributes() {
      const { nativeField, textField } = this.constructor.options

      const attributes = {
        'data-vv-name': this.dataPath,
        'data-vv-as': this.label || this.placeholder || this.name,
        // Validate with a little delay. This is mainly needed for password
        // handling in TypeText, but may be of use in other places also.
        'data-vv-delay': 1,
        disabled: this.disabled
      }

      if (nativeField) {
        attributes.name = this.dataPath
        attributes.title = this.label
        attributes.readonly = this.readonly
        attributes.autofocus = this.autofocus
        if (textField) {
          attributes.placeholder = this.placeholder
          attributes.autocomplete = this.autocomplete
        }
      }
      return attributes
    },

    events() {
      return {
        focus: () => this.onFocus(),
        blur: () => this.onBlur(),
        input: () => this.onInput(),
        change: () => this.onChange()
      }
    },

    validations() {
      const rules = this.getValidationRules()
      if (this.required) {
        rules.required = true
      }
      // Allow schema to override default rules and add any new ones:
      for (const [key, value] of Object.entries(this.schema.rules || {})) {
        if (value === undefined) {
          delete rules[key]
        } else {
          rules[key] = value
        }
      }
      return { rules }
    },

    verbs() {
      return this.formComponent.verbs
    }
  },

  created() {
    this.schemaComponent?.registerComponent(this.dataPath, this)
    this.setupWatchHandlers()
  },

  destroyed() {
    this.schemaComponent?.registerComponent(this.dataPath, null)
  },

  methods: {
    setupWatchHandlers() {
      let { watch } = this.schema
      if (watch) {
        if (isFunction(watch)) {
          watch = watch.call(this)
        }
        if (isObject(watch)) {
          // Install the watch handlers in the next tick, so all components are
          // initialized and we can check against their names.
          this.$nextTick(() => {
            for (const [key, callback] of Object.entries(watch)) {
              // Expand property names to 'data.property':
              const expr = key in this.schemaComponent.components
                ? `data.${key}`
                : key
              this.$watch(expr, callback)
            }
          })
        }
      }
    },

    getValidationRules() {
      // This method exists to make it easier to extend validations in type
      // components.
      return {}
    },

    load({ cache, ...options }) {
      // Allow caching of loaded data on two levels:
      // - 'global': cache globally, for the entire admin session
      // - 'local': cache locally within the current editing schema
      const cacheParent = {
        global: this.appState,
        local: this.schemaComponent
      }[cache]
      const loadCache = cacheParent?.loadCache
      // Build a cache key from the config:
      const cacheKey = loadCache && `${
        options.method || 'get'} ${
        options.url} ${
        JSON.stringify(options.params || '')} ${
        JSON.stringify(options.data || '')
      }`
      if (loadCache && (cacheKey in loadCache)) {
        return loadCache[cacheKey]
      }
      // NOTE: No await here, res is a promise that we can easily cache.
      const res = this.api.request(options)
        .then(response => response.data)
        .catch(error => {
          // Convert axios errors to normal errors
          const data = error.response?.data
          throw data
            ? Object.assign(new Error(data.message), data)
            : error
        })
      if (loadCache) {
        loadCache[cacheKey] = res
      }
      return res
    },

    addError(error, addPrefix) {
      // Convert to the same sentence structure as vee-validate:
      const field = this.label || this.placeholder || this.name
      const prefix = addPrefix && `The ${field} field`
      console.log('adding', error)
      this.$errors.add({
        field: this.dataPath,
        msg: !prefix || error.startsWith(prefix) ? error : `${prefix} ${error}.`
      })
      // Remove the error as soon as the field is changed.
      this.$once('input', () => {
        this.$errors.remove(this.dataPath)
      })
    },

    addErrors(errors, focus) {
      for (const { message } of errors) {
        this.addError(message, true)
      }
      if (focus) {
        this.focus()
      }
    },

    focus() {
      // Also focus this component's panel in case it's a tab.
      this.$parent.focus()
      const { element } = this.$refs
      const focus = isArray(element) ? element[0] : element
      if (focus) {
        this.$nextTick(() => focus.focus())
      }
    },

    onFocus() {
      this.focused = true
      this.$emit('focus')
      this.schema.onFocus?.call(this, getItemParams(this))
    },

    onBlur() {
      this.focused = false
      this.$emit('blur')
      this.schema.onBlur?.call(this, getItemParams(this))
    },

    onInput() {
      this.$emit('input')
      this.schema.onInput?.call(this, getItemParams(this))
    },

    onChange(event) {
      this.$emit('change', event)
      this.schema.onChange?.call(this, getItemParams(this))
    }
  }
}
