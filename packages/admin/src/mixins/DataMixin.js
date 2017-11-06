import axios from 'axios'
import { isObject } from '@/utils'

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
      return !!this.viewSchema.nested
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

    verbSave() {
      return this.isTransient ? 'apply' : 'save'
    },

    verbDelete() {
      return this.isTransient ? 'remove' : 'delete'
    },

    verbEdit() {
      return 'edit'
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

    getItemId(item, index) {
      const { idName = 'id' } = this.formSchema
      return String(this.isTransient ? index : item[idName])
    },

    getItemTitle(item, schema) {
      schema = schema || this.formSchema
      const { getTitle } = schema
      const label = this.getLabel(schema)
      const title = getTitle ? getTitle(item) : item.name
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
        const { paginate, scope } = this.viewSchema
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
      this.errors.remove('dito-request')
      this.setLoading(true)
      request(method, path, params, payload, (err, response) => {
        setTimeout(() => {
          this.setLoading(false)
          // Do not report validation errors as dito-request errors
          if (err && !(callback && this.hasValidationError(response))) {
            this.errors.add('dito-request', err.toString())
          }
          if (callback) {
            callback(err, response)
          }
        }, 0)
      })
    },

    requestAxios(method, path, params, payload, callback) {
      const config = {
        baseURL: this.api.baseURL,
        headers: this.api.headers || {
          'Content-Type': 'application/json'
        },
        params
      }
      const promise = /^(post|put|patch)$/.test(method)
        ? axios[method](path, JSON.stringify(payload), config)
        : axios[method](path, config)
      promise
        .then(response => callback(null, response))
        .catch(error => callback(error, error.response))
    }
  }
}
