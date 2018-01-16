import TypeComponent from '@/TypeComponent'
import axios from 'axios'
import {
  isArray, isObject, isString, isFunction, pick, clone
} from 'dito-utils'

export default {
  data() {
    return {
      loadedData: null,
      loading: false
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

    verbCreate() {
      return this.isTransient ? 'add' : 'create'
    },

    verbCreated() {
      return this.isTransient ? 'added' : 'created'
    },

    verbSave() {
      return this.isTransient ? 'apply' : 'save'
    },

    verbSaved() {
      return this.isTransient ? 'applied' : 'saved'
    },

    verbSubmit() {
      return this.create ? this.verbCreate : this.verbSave
    },

    verbSubmitted() {
      return this.create ? this.verbCreated : this.verbSaved
    },

    verbDelete() {
      return this.isTransient ? 'remove' : 'delete'
    },

    verbDeleted() {
      return this.isTransient ? 'removed' : 'deleted'
    },

    verbEdit() {
      return 'edit'
    },

    verbEdited() {
      return 'edited'
    },

    verbCancel() {
      return 'cancel'
    },

    verbCanceled() {
      return 'canceled'
    }
  },

  methods: {
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
      // eslint-disable-next-line
      const type = item?.type
      return forms && type ? forms[type] : form
    },

    getItemId(item, index) {
      const { idName = 'id' } = this.listSchema
      const id = this.isTransient ? index : item[idName]
      return id === undefined ? id : String(id)
    },

    findItemIdIndex(data, itemId) {
      // For transient data, the index is used as the id
      return this.isTransient
        ? itemId
        : data?.findIndex(
          (item, index) => this.getItemId(item, index) === itemId
        )
    },

    getItemLabel(item, index) {
      const label = this.getLabel(this.getFormSchema(item))
      const { itemLabel, columns } = this.listSchema
      const itemProp = isString(itemLabel) && itemLabel ||
        columns && Object.keys(columns)[0]
      let title = isFunction(itemLabel) ? itemLabel(item)
        : itemProp ? item[itemProp]
        : item.name
      if (title) {
        title = ` ${title}`
      } else {
        const id = this.getItemId(item)
        title = id
          ? ` (id:${id})`
          : index !== undefined
            ? ` ${index + 1}`
            : ''
      }
      return `${label}${title}`
    },

    setData(data) {
      this.loadedData = data
    },

    initData() {
      if (this.shouldLoad) {
        this.loadData(true)
      }
    },

    createData(schema, data = {}) {
      // Sets up an createdData object that has keys with null-values for all
      // form fields, so they can be correctly watched for changes.
      const {
        tabs = {},
        components = {}
      } = schema || {}
      for (const tabSchema of Object.values(tabs)) {
        this.createData(tabSchema, data)
      }
      for (const [key, compSchema] of Object.entries(components)) {
        // Support default values both on schema and on component level.
        const comp = TypeComponent.get(compSchema.type)
        const defaultValue = pick(compSchema.default,
          comp?.options.methods.defaultValue)
        data[key] = isFunction(defaultValue)
          ? defaultValue()
          : clone(defaultValue) || null
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

    setLoading(loading) {
      this.loading = this.appState.loading = loading
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
        baseURL: this.api.baseURL,
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

      // Helper to convert properties expression in JSON notation to strings,
      // see parsePropertiesExpression() in dito-server.
      function toPropertiesExpression(expression) {
        return Object.entries(expression).map(
          ([modelName, properties]) => `${modelName}[${properties.join(',')}]`
        ).join(',')
      }

      const { paginate, eager, pick, omit } = this.listSchema
      const { page = 0, ...query } = this.query || {}
      const limit = this.isList && paginate // Only use range on lists
      const offset = page * limit
      return {
        ...query, // Query may override scope.
        ...(eager && { eager }),
        ...(pick && { pick: toPropertiesExpression(pick) }),
        ...(omit && { omit: toPropertiesExpression(omit) }),
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
    },

    processPayload(data) {
      // dito-server specific handling of relates within graphs:
      // Find and group entries with temporary ids, and convert them to
      // #id / #ref pairs.
      const encounterdIds = {}

      const process = data => {
        if (data) {
          if (isObject(data)) {
            let processed = {}
            for (const key in data) {
              processed[key] = process(data[key])
            }

            const { id } = processed
            if (/^@/.test(id)) {
              // The first time a temporary id is encountered, replace it with
              // the #id key. All other encounters are replaced with shallow
              // #ref references to it.
              if (!encounterdIds[id]) {
                encounterdIds[id] = true
                delete processed.id
                processed['#id'] = id
              } else {
                processed = { '#ref': id }
              }
            }

            data = processed
          } else if (isArray(data)) {
            data = data.map(entry => process(entry))
          }
        }
        return data
      }

      return process(data)
    }
  }
}
