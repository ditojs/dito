import TypeComponent from '@/TypeComponent'
import ItemMixin from './ItemMixin'
import LoadingMixin from './LoadingMixin'
import { hasForms } from '@/utils/schema'
import { isString, isFunction, clone, labelize, asArray } from '@ditojs/utils'

// @vue/component
export default {
  mixins: [ItemMixin, LoadingMixin],

  provide() {
    return {
      // Pass local verbs overrides on to children, see verbs()
      $verbs: this.verbs
    }
  },

  data() {
    return {
      loadedData: null
    }
  },

  computed: {
    isNested() {
      return !!this.sourceSchema.nested
    },

    isTransient() {
      let transient = this.isNested
      if (!transient) {
        const parent = this.parentFormComponent
        transient = parent?.isTransient || parent?.create
      }
      return transient
    },

    shouldLoad() {
      return !this.isTransient && !this.isLoading
    },

    shouldReload() {
      // NOTE: Not all route components have the DataMixin (DitoView delegates
      // loading to TypeList), so we can't directly force a reload on
      // this.parentRouteComponent in DitoForm.close(). Instead, we use a
      // reload flag on the closest routeComponent and respect it in created()
      return !this.isTransient && this.routeComponent.reload
    },

    verbs() {
      // The actual code is the `getVerbs()` method, for easier overriding of
      // this computed property in components that use the DataMixin.
      return this.getVerbs()
    }
  },

  created() {
    this.setupData()
  },

  methods: {
    getVerbs() {
      return this.isTransient
        ? {
          ...this.$verbs,
          // Override default verbs with their transient versions:
          create: 'add',
          created: 'added',
          save: 'apply',
          saved: 'applied',
          delete: 'remove',
          deleted: 'removed'
        }
        : this.$verbs
    },

    getResourcePath(resource) {
      const { type, id, path } = resource
      const url = this.api.resources[type](this, id)
      return path
        ? /^\//.test(path) ? path : `${url}/${path}`
        : url
    },

    findItemIdIndex(data, itemId) {
      const index = this.isTransient
        // For transient data, the index is used as the id
        ? itemId
        : data?.findIndex(
          (item, index) =>
            this.getItemId(this.sourceSchema, item, index) === itemId
        )
      return index !== -1 ? index : null
    },

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
      if (this.shouldReload) {
        this.reloadData()
      } else if (this.shouldLoad) {
        this.loadData(true)
      }
    },

    reloadData() {
      if (!this.isTransient) {
        this.loadData(false)
      }
      this.routeComponent.reload = false
    },

    loadData(clear) {
      if (!this.isTransient) {
        if (clear) {
          this.loadedData = null
          // See DitoMixin for an explanation of `store.total` & co.
          this.setStore('total', 0)
        }
        this.requestData()
      }
    },

    createData(schema, type) {
      return this.setDefaults(schema, type ? { type } : {})
    },

    setDefaults(schema, data = {}) {
      // Sets up a data object that has keys with default values for all
      // form fields, so they can be correctly watched for changes.
      const processComponents = (components = {}) => {
        for (const [key, componentSchema] of Object.entries(components)) {
          // Support default values both on schema and on component level.
          // NOTE: At the time of creation, components may not be instantiated,
          // (e.g. if entries are created through nested forms, the parent form
          // isn't mounted) so we can't use `dataPath` to get to components,
          // and then to the defaultValue from there. That's why defaultValue is
          // a 'static' value on the component definitions:
          if (!(key in data)) {
            const component = TypeComponent.get(componentSchema.type)
            const defaultValue =
              componentSchema.default ??
              component?.options.defaultValue
            data[key] = isFunction(defaultValue)
              ? defaultValue(componentSchema)
              : clone(defaultValue)
          }
          // Recursively set defaults on nested forms
          if (hasForms(componentSchema)) {
            asArray(data[key]).forEach(item => {
              const formSchema = this.getItemFormSchema(componentSchema, item)
              if (item && formSchema) {
                this.setDefaults(formSchema, item)
              }
            })
          }
        }
      }

      processComponents(schema.components)
      if (schema.tabs) {
        Object.values(schema.tabs).forEach(processComponents)
      }
      return data
    },

    requestData() {
      const params = this.getQueryParams()
      this.request('get', { params }, (err, response) => {
        if (err) {
          if (response) {
            const { data } = response
            if (data?.type === 'FilterValidation' && this.onFilterErrors) {
              this.onFilterErrors(data.errors)
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
      const { resource, payload: data, params } = options
      const url = this.getResourcePath(resource || this.resource)
      this.setLoading(true)
      const request = { method, url, data, params }
      try {
        await this.rootComponent.onBeforeRequest(request)
        const response = await this.api.request(request)
        await this.rootComponent.onAfterRequest(request)
        callback?.(null, response)
      } catch (error) {
        // If callback returns true, errors were already handled.
        const { response } = error
        if (!callback?.(error, response)) {
          const data = response?.data
          if (data && isString(data.type)) {
            this.notify('error', labelize(data.type), data.message || error)
          } else {
            this.notify('error', 'Request Error', error)
          }
        }
      }
      this.setLoading(false)
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
