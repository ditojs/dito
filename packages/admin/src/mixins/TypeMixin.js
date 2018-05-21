import { isArray, isAbsoluteUrl } from '@ditojs/utils'

export default {
  // Inherit the $validator from the parent.
  // See: https://github.com/logaretm/vee-validate/issues/468
  // NOTE: We can't do this in DitoMixin for all components, as it would
  // override the $validates: true` setting there.
  inject: ['$validator'],

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: false }
  },

  data() {
    return {
      focused: false
    }
  },

  // Register and unregister all type components on their parent forms for easy
  // lookup.
  created() {
    const { routeComponent, dataRouteComponent, dataPath } = this
    if (routeComponent) {
      routeComponent.components[dataPath] = this
      // If this component is nested, also register its components with the root
      // route component.
      // This is needed for processValue() to be able to correctly process all
      // nested data, even if the nested form was already closed on submit.
      if (dataRouteComponent !== routeComponent) {
        dataRouteComponent.components[dataPath] = this
      }
    }
  },

  destroyed() {
    const form = this.formComponent
    if (form) {
      delete form.components[this.dataPath]
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
        return this.data[this.name]
      },

      set(value) {
        this.$set(this.data, this.name, value)
      }
    },

    label() {
      return this.getLabel(this.schema)
    },

    step() {
      const { step } = this.schema
      return this.isInteger && step !== undefined ? Math.ceil(step) : step
    },

    min() {
      const { schema } = this
      const min = schema.range ? schema.range[0] : schema.min
      return this.isInteger && min !== undefined ? Math.floor(min) : min
    },

    max() {
      const { schema } = this
      const max = schema.range ? schema.range[1] : schema.max
      return this.isInteger && max !== undefined ? Math.ceil(max) : max
    },

    decimals() {
      return this.schema.decimals
    },

    required() {
      return !!this.schema.required
    },

    validations() {
      const rules = this.getValidationRules()
      return { rules }
    },

    verbs() {
      return this.formComponent.verbs
    }
  },

  methods: {
    getValidationRules() {
      // This method exists to make it easier to override `validations` computed
      // property in type components.
      const rules = {}
      if (this.required) {
        // A poor design choice in vee-validate: The option for the `required`
        // validator is `invalidateFalse`, `true` by default. So we need to set
        // `required` to `false` here to activate it & disable `invalidateFalse`
        rules.required = false
      }
      if (this.min) {
        rules.min_value = this.min
      }
      if (this.max) {
        rules.max_value = this.max
      }
      if (this.decimals) {
        rules.decimal = this.decimals
      } else if (this.step) {
        const decimals = (`${this.step}`.split('.')[1] || '').length
        if (decimals > 0) {
          rules.decimal = decimals
        } else {
          rules.numeric = true
        }
      }
      if (this.isInteger) {
        rules.numeric = true
      }
      return rules
    },

    getAttributes(nativeField = false, textField = false) {
      const attributes = {
        ref: 'element',
        'data-vv-name': this.dataPath,
        'data-vv-as': this.label,
        disabled: this.disabled
      }

      const addAttribute = (key, matchRole = false) => {
        const value = this.getSchemaValue(key, matchRole)
        if (value !== undefined) {
          attributes[key] = value
        }
      }

      if (nativeField) {
        attributes.name = this.dataPath
        attributes.title = this.label
        addAttribute('readonly', true)
        addAttribute('autofocus')
        if (textField) {
          addAttribute('placeholder')
        }
      }
      return attributes
    },

    getEvents(nativeField = false, textField = false) {
      const events = {}
      if (nativeField && textField) {
        events.focus = () => {
          this.focused = true
        }
        events.blur = () => {
          this.focused = false
        }
      }
      return events
    },

    load({ cache, ...options }) {
      // See if we need to consult the cache first, and allow caching on global
      // level ('global') and form level ('form').
      // If no cache setting was provided, use different defaults for relative
      // api calls ('form'), and absolute url calls ('global').
      // Provide `cache: false` to explicitly disable caching.
      const cacheType = cache === undefined
        ? isAbsoluteUrl(options.url) ? 'global' : 'form'
        : cache
      // Build a cache key from the config.
      const cacheKey = cacheType && `${
        options.method || 'get'} ${
        options.url} ${
        JSON.stringify(options.params || '')} ${
        JSON.stringify(options.data || '')
      }`
      const loadCache =
        cacheType === 'global' ? this.appState.loadCache
        : cacheType === 'form' ? this.formComponent.loadCache
        : null
      if (loadCache && (cacheKey in loadCache)) {
        return loadCache[cacheKey]
      }
      // NOTE: No await here, res is a promise that we can easily cache.
      const res = this.api.request(options)
        .then(response => response.data)
        .catch(error => {
          // Convert axios errors to normal errors
          throw error.response
            ? new Error(error.response?.data)
            : error
        })
      if (loadCache) {
        loadCache[cacheKey] = res
      }
      return res
    },

    processValue(value, dataPath) {
      const { schema } = this
      return schema.exclude
        ? undefined
        : schema.process
          ? schema.process(value, this.data, dataPath) ?? value
          : value
    },

    addError(error) {
      // Convert to the same sentence structure as vee-validate:
      const prefix = `The ${this.label} field`
      this.$errors.add(this.dataPath,
        error.startsWith(prefix) ? error : `${prefix} ${error}.`)
    },

    addErrors(errors, focus) {
      for (const { message } of errors) {
        this.addError(message)
      }
      if (focus) {
        this.focus()
      }
    },

    navigateToErrors(dataPath, errors) {
      const navigate = this.navigateToComponent
      if (navigate) {
        navigate.call(this, dataPath, (route, property) => {
          const { matched } = route
          const { meta } = matched[matched.length - 1]
          // Pass on the errors to the instance through the meta object,
          // see DitoForm.created()
          if (property) {
            meta.errors = {
              [property]: errors
            }
          }
        })
      } else {
        throw new Error(`Cannot show errors for field ${dataPath}: ${errors}`)
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
    }
  }
}
