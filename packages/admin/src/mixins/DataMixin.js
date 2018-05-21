import TypeComponent from '@/TypeComponent'
import LoadingMixin from './LoadingMixin'
import { isListSource } from '@/utils/schema'
import { isString, isFunction, clone } from '@ditojs/utils'

export default {
  mixins: [LoadingMixin],

  data() {
    return {
      loadedData: null
    }
  },

  created() {
    // Give other mixins the change to receive created() events first, e.g.
    // SourceMixin to set up query:
    this.$nextTick(() => this.initData())
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
      return !this.isTransient && !this.loading
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

  methods: {
    getVerbs() {
      const verbs = this.isTransient
        ? {
          create: 'add',
          created: 'added',
          save: 'apply',
          saved: 'applied',
          delete: 'remove',
          deleted: 'removed'
        }
        : {
          create: 'create',
          created: 'created',
          save: 'save',
          saved: 'saved',
          delete: 'delete',
          deleted: 'deleted'
        }
      return {
        ...verbs,
        edit: 'edit',
        edited: 'edited',
        cancel: 'cancel',
        cancelled: 'cancelled',
        drag: 'drag',
        dragged: 'dragged',
        submit: this.create ? verbs.create : verbs.save,
        submitted: this.create ? verbs.created : verbs.saved
      }
    },

    getResourcePath(resource) {
      const { type, id, path } = resource
      const url = this.api.resources[type](this, id)
      return path
        ? /^\//.test(path) ? path : `${url}/${path}`
        : url
    },

    getFormSchema(item) {
      const { form, forms } = this.sourceSchema
      const type = item?.type
      return forms && type ? forms[type] : form
    },

    getItemId(item, index) {
      const { idName = 'id' } = this.sourceSchema
      const id = this.isTransient ? index : item[idName]
      return id === undefined ? id : String(id)
    },

    findItemIdIndex(data, itemId) {
      const index = this.isTransient
        // For transient data, the index is used as the id
        ? itemId
        : data?.findIndex(
          (item, index) => this.getItemId(item, index) === itemId
        )
      return index !== -1 ? index : null
    },

    getItemLabel(item, { index, formLabel = true, autoLabel = true } = {}) {
      const { itemLabel, columns } = this.sourceSchema
      if (itemLabel === false) return null
      const itemProperty = isString(itemLabel) && itemLabel ||
        columns && Object.keys(columns)[0] ||
        'name'
      let label = (
        isFunction(itemLabel)
          ? itemLabel(item)
          : item[itemProperty]
      ) ?? null
      if (autoLabel && label == null) {
        const id = this.getItemId(item)
        label = id
          ? `(id: ${id})`
          : isListSource(this.sourceSchema) && index !== undefined
            ? `${index + 1}`
            : ''
        if (label) {
          formLabel = true
        }
      }
      return formLabel && label
        ? `${this.getLabel(this.getFormSchema(item))} ${label}`
        : label || ''
    },

    setData(data) {
      this.loadedData = data
    },

    initData() {
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
      const data = type ? { type } : {}
      // Sets up a data object that has keys with default values for all
      // form fields, so they can be correctly watched for changes.
      const processComponents = (components = {}) => {
        for (const [key, componentSchema] of Object.entries(components)) {
          // Support default values both on schema and on component level.
          // NOTE: At the time of creation, components may not be instantiated,
          // (e.g. if entries are created through  nested forms, the parent form
          // isn't mounted) so we can't use `dataPath` to get to components,
          // and then to the defaultValue from there. That's why defaultValue is
          // a 'static' value on the component definitions:
          const component = TypeComponent.get(componentSchema.type)
          const defaultValue =
            componentSchema.default ??
            component?.options.defaultValue ??
            null
          data[key] = isFunction(defaultValue)
            ? defaultValue(componentSchema)
            : clone(defaultValue)
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
          if (response?.status === 401) {
            return true
          }
        } else {
          this.setData(response.data)
        }
      })
    },

    hasValidationError(response) {
      return response?.status === 400
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
        if (!callback?.(error, error.response)) {
          this.notify('error', 'Request Error', error)
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
