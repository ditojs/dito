import ItemMixin from './ItemMixin'
import LoadingMixin from './LoadingMixin'
import { setDefaults } from '@/utils/schema'
import { isString, labelize } from '@ditojs/utils'
import { getResource } from '@/utils/resource'

// @vue/component
export default {
  mixins: [ItemMixin, LoadingMixin],

  provide() {
    return {
      // Pass local verbs overrides on to children, see verbs() computed prop.
      $verbs: () => this.verbs,
      $isPopulated: () => this.hasData
    }
  },

  data() {
    return {
      loadedData: null
    }
  },

  computed: {
    resource() {
      // Returns the resource object representing the resource for the
      // associated source schema.
      return this.getResource()
    },

    hasResource() {
      // This component is a data-source if it has an associated API resource:
      return !!this.resource
    },

    isTransient() {
      // Check the form that this component belongs to as well, since it may be
      // in creation mode, which makes it transient.
      // NOTE: This does not loop endlessly because DitoForm redefines
      // `isTransient()` to only return `!this.hasResource`.
      const form = this.formComponent
      return (
        !this.hasResource ||
        form && (
          form.isTransient ||
          form.isCreating
        )
      )
    },

    shouldLoad() {
      return (
        !this.isTransient &&
        !this.isLoading
      )
    },

    // @overridable
    hasData() {
      // Base definition, will be overridden by DitoForm and SourceMixin
      return !!this.loadedData
    },

    verbs() {
      // The actual code is the `getVerbs()` method, for easier overriding of
      // this computed property in components that use the ResourceMixin.
      return this.getVerbs()
    }
  },

  created() {
    // When creating nested data, we still need to call setupData()
    if (this.hasResource || this.isCreating) {
      this.setupData()
    }
  },

  methods: {
    getResource() {
      // This is defined as a method so the computed `resource` getter can
      // be overridden and `super` functionality can still be accessed.
      return getResource(this.sourceSchema.resource, {
        type: 'collection',
        parent: this.parentFormComponent?.resource
      })
    },

    getVerbs() {
      const verbs = this.$verbs()
      return this.isTransient
        ? {
          ...verbs,
          // Override default verbs with their transient versions:
          create: 'add',
          created: 'added',
          save: 'apply',
          saved: 'applied',
          delete: 'remove',
          deleted: 'removed'
        }
        : verbs
    },

    // @overridable
    clearData() {
      this.loadedData = null
    },

    // @overridable
    setData(data) {
      this.loadedData = data
    },

    setupData() {
      // Actual code is in separate function so it's easer to override
      // `setupData()` and and call `ensureData()` from the overrides,
      // see DitoForm and SourceMixin.
      this.ensureData()
    },

    ensureData() {
      if (this.shouldLoad) {
        if (this.hasData) {
          this.reloadData()
        } else {
          this.loadData(true)
        }
      }
    },

    reloadData() {
      if (!this.isTransient) {
        this.loadData(false)
      }
    },

    loadData(clear) {
      if (!this.isTransient) {
        if (clear) {
          this.clearData()
        }
        this.requestData()
      }
    },

    createData(schema, type) {
      return setDefaults(schema, type ? { type } : {})
    },

    requestData() {
      const params = this.getQueryParams()
      this.request('get', { params }, (err, { response }) => {
        if (err) {
          if (response) {
            const { data } = response
            if (
              data?.type === 'FilterValidation' &&
              this.onFilterErrors?.(data.errors)) {
              return true
            } else if (this.isUnauthorizedError(response)) {
              // TODO: Can we really swallow these errors?
              // Is calling `ensureUser()` in `onBeforeRequest()` enough?
              return true
            }
          }
        } else {
          this.setData(response.data)
        }
      })
    },

    isValidationError(response) {
      return response?.status === 400
    },

    isUnauthorizedError(response) {
      return response?.status === 401
    },

    async request(method, options, callback) {
      this.setLoading(true, this.viewComponent)
      const {
        resource = this.resource,
        payload: data,
        params
      } = options
      const request = {
        method,
        resource,
        data,
        params
      }
      try {
        const response = await this.rootComponent.request(request)
        // Pass both request and response to the callback, so they can be
        // exposed to further callbacks through ItemParams.
        callback?.(null, { request, response })
      } catch (error) {
        // If callback returns true, errors were already handled.
        const { response } = error
        if (!callback?.(error, { request, response })) {
          const data = response?.data
          if (data && isString(data.type)) {
            this.notify('error', labelize(data.type), data.message || error)
          } else {
            this.notify('error', 'Request Error', error)
          }
        }
      } finally {
        this.setLoading(false, this.viewComponent)
      }
    },

    // @ditojs/server specific processing of parameters, payload and response:
    getQueryParams() {
      // @ditojs/server specific query parameters:
      // TODO: Consider moving this into a modular place, so other backends
      // could plug in as well.
      const { paginate } = this.sourceSchema
      const { page = 0, ...query } = this.query || {}
      const limit = this.isListSource && paginate // Only apply ranges on lists.
      const offset = page * limit
      return {
        ...query, // Query may override scope.
        // Convert offset/limit to range so that we get results counting:
        ...(limit && {
          range: `${offset},${offset + limit - 1}`
        })
      }
    }
  }
}
