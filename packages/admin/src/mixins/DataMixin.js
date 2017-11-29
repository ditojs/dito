import axios from 'axios'
import TypeComponent from '@/TypeComponent'
import { isObject, isString, isFunction, pick, clone } from '@/utils'

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
    listSchema() {
      return this.meta.listSchema
    },

    isNested() {
      return !!this.listSchema.nested
    },

    isTransient() {
      let transient = this.isNested
      if (!transient) {
        const parent = this.parentFormComponent
        transient = parent && (parent.isTransient || parent.create)
      }
      return transient
    },

    shouldLoad() {
      return !this.isTransient
    },

    shouldReload() {
      // NOTE: Not all route components have the DataMixin (DitoView delegates
      // loading to DitoList), so we can't directly force a reload on
      // this.parentRouteComponent in DitoForm.goBack(). Instead, we use a
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
      const type = item && item.type
      return forms && type ? forms[type] : form
    },

    getItemId(item, index) {
      const { idName = 'id' } = this.listSchema
      return String(this.isTransient ? index : item[idName])
    },

    getItemTitle(item) {
      const label = this.getLabel(this.getFormSchema(item))
      const { itemTitle, columns } = this.listSchema
      const itemProp = isString(itemTitle) && itemTitle ||
        columns && Object.keys(columns)[0]
      const title = isFunction(itemTitle) ? itemTitle(item)
        : itemProp ? item[itemProp]
        : item.name
      return `${label} ${title ? `"${title}"` : `(id:${this.getItemId(item)})`}`
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
          comp && comp.options.methods.defaultValue)
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
        // Dito specific query parameters:
        // Convert offset/limit to range so that we get entry counting
        const { paginate, scope } = this.listSchema
        const { page = 0, ...query } = this.query || {}
        const limit = this.isList && paginate // Only use range on lists
        const offset = page * limit
        const params = {
          scope, // Default scope first.
          ...query, // Query my override scope.
          ...(limit && {
            range: `${offset},${offset + limit - 1}`
          })
        }
        this.request('get', { params }, (err, response) => {
          if (!err) {
            let { data } = response
            if (this.resource.type === 'collection' && isObject(data)) {
              this.setStore('total', data.total)
              data = data.results
            }
            this.setData(data)
          }
        })
      }
    },

    setLoading(loading) {
      this.appState.loading = this.loading = loading
    },

    hasValidationError(response) {
      return response && response.status === 400
    },

    request(method, options, callback) {
      const request = this.api.request || this.requestAxios
      const { resource, params, payload } = options
      const path = this.getResourcePath(resource || this.resource)
      this.setLoading(true)
      request(method, path, params, payload, (err, response) => {
        setTimeout(() => {
          this.setLoading(false)
          // Do not report validation errors as dito-request errors
          if (err && !(callback && this.hasValidationError(response))) {
            this.notify('error', 'Request Error', err)
          }
          if (callback) {
            callback(err, response)
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
    }
  }
}
