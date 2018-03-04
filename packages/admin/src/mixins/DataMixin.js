import TypeComponent from '@/TypeComponent'
import axios from 'axios'
import LoadingMixin from './LoadingMixin'
import { isObject, isString, isFunction, pick, clone } from '@ditojs/utils'

export default {
  mixins: [LoadingMixin],

  data() {
    return {
      loadedData: null
    }
  },

  created() {
    // Give other mixins the change to receive created() events first, e.g.
    // ListMixin to set up query:
    this.$nextTick(() => {
      if (this.shouldReload) {
        this.reloadData()
      } else {
        this.initData()
      }
    })
  },

  computed: {
    isNested() {
      return !!this.listSchema.nested
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
        canceled: 'canceled',
        drag: 'drag',
        dragged: 'dragged',
        submit: this.create ? verbs.create : verbs.save,
        submited: this.create ? verbs.created : verbs.saved
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
      const { listSchema } = this
      const { form, forms } = listSchema
      const type = item?.type
      return forms && type ? forms[type] : form
    },

    getItemId(item, index) {
      const { idName = 'id' } = this.listSchema
      const id = this.isTransient ? index : item[idName]
      return id === undefined ? id : String(id)
    },

    findItemIdIndex(data, itemId) {
      return this.isTransient
        // For transient data, the index is used as the id
        ? itemId
        : data?.findIndex(
          (item, index) => this.getItemId(item, index) === itemId
        )
    },

    getItemLabel(item, index, fallback = true) {
      const { itemLabel, columns } = this.listSchema
      if (itemLabel === false) return null
      const itemProperty = isString(itemLabel) && itemLabel ||
        columns && Object.keys(columns)[0] ||
        'name'
      let label = isFunction(itemLabel)
        ? itemLabel(item)
        : pick(item[itemProperty], null)
      if (label == null && fallback) {
        const formLabel = this.getLabel(this.getFormSchema(item))
        const id = this.getItemId(item)
        label = id
          ? ` (id:${id})`
          : index !== undefined
            ? ` ${index + 1}`
            : ''
        label = `${formLabel}${label}`
      }
      return label
    },

    setData(data) {
      this.loadedData = data
    },

    initData() {
      if (this.shouldLoad) {
        this.loadData(true)
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
          const defaultValue = pick(
            componentSchema.default,
            component?.options.defaultValue,
            null
          )
          data[key] = isFunction(defaultValue)
            ? defaultValue(componentSchema.type)
            : clone(defaultValue)
        }
      }

      processComponents(schema.components)
      if (schema.tabs) {
        Object.values(schema.tabs).forEach(processComponents)
      }
      return data
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

    requestData() {
      const params = this.getQueryParams()
      this.request('get', { params }, (err, response) => {
        if (!err) {
          this.setData(this.processResponse(response.data))
        }
      })
    },

    hasValidationError(response) {
      return response?.status === 400
    },

    request(method, options, callback) {
      const request = this.api.request || this.requestAxios
      const { resource, params, payload } = options
      const path = this.getResourcePath(resource || this.resource)
      this.setLoading(true)
      request(method, path, params, payload, (err, response) => {
        setTimeout(() => {
          this.setLoading(false)
          // If callback returns true, errors were already handled.
          if (!callback?.(err, response) && err) {
            this.notify('error', 'Request Error', err)
          }
        }, 0)
      })
    },

    requestAxios(method, url, params, payload, callback) {
      const data = /^(post|put|patch)$/.test(method)
        ? JSON.stringify(payload)
        : null
      axios.request({
        url,
        method,
        data,
        baseURL: this.api.url,
        headers: this.api.headers || {
          'Content-Type': 'application/json'
        },
        params
      })
        .then(response => callback(null, response))
        .catch(error => callback(error, error.response))
    },

    // dito-server specific processing of parameters, payload and response:

    getQueryParams() {
      // dito-server specific query parameters:
      // TODO: Consider moving this into a modular place, so other backends
      // could plug in as well.
      const { paginate } = this.listSchema
      const { page = 0, ...query } = this.query || {}
      const limit = this.isList && paginate // Only use range on lists
      const offset = page * limit
      return {
        ...query, // Query may override scope.
        // Convert offset/limit to range so that we get results counting:
        ...(limit && {
          range: `${offset},${offset + limit - 1}`
        })
      }
    },

    processResponse(data) {
      // dito-server specific handling of paginated response:
      if (this.resource.type === 'collection' && isObject(data)) {
        this.setStore('total', data.total)
        data = data.results
      }
      return data
    }
  }
}
