import { isArray, isAbsoluteUrl } from '@ditojs/utils'
import { getSchemaAccessor } from '@/utils/accessor'

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

    label: getSchemaAccessor('label', function() {
      return this.getLabel(this.schema)
    }),

    width: getSchemaAccessor('width'),
    visible: getSchemaAccessor('visible'),
    required: getSchemaAccessor('required'),
    decimals: getSchemaAccessor('decimals'),

    step: getSchemaAccessor('step', function() {
      const step = this.getSchemaValue('step')
      return this.isInteger && step !== undefined ? Math.ceil(step) : step
    }),

    min: getSchemaAccessor('min', function() {
      const { schema } = this
      const min = schema.range ? schema.range[0] : schema.min
      return this.isInteger && min != null ? Math.floor(min) : min
    }),

    max: getSchemaAccessor('max', function() {
      const { schema } = this
      const max = schema.range ? schema.range[1] : schema.max
      return this.isInteger && max !== undefined ? Math.ceil(max) : max
    }),

    range: getSchemaAccessor('range',
      function get() {
        const { min, max } = this
        return min !== undefined && max !== undefined ? [min, max] : undefined
      },
      // Provide a setter that delegates to `[this.min, this.max]`, since those
      // already handle `schema.range`.
      function set(range) {
        if (isArray(range)) {
          [this.min, this.max] = range
        }
      }
    ),

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
        rules.required = true
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

    getAttributes() {
      const {
        nativeField = false,
        textField = false
      } = this.constructor.options

      const attributes = {
        ref: 'element',
        'data-vv-name': this.dataPath,
        'data-vv-as': this.label,
        // Validate with a little delay. This is mainly needed for password
        // handling in TypeText, but may be of use in other places also.
        'data-vv-delay': 1,
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

    getEvents() {
      const {
        nativeField = false
      } = this.constructor.options

      const events = {}
      if (nativeField) {
        events.change = event => this.onChange(event)
        events.focus = event => this.onFocus(event)
        events.blur = event => this.onBlur(event)
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
    },

    onFocus(event) {
      this.focused = true
      this.$emit('focus', event)
    },

    onBlur(event) {
      this.focused = false
      this.$emit('blur', event)
    },

    onChange(event) {
      this.$emit('change', event)
    }
  }
}
