import axios from 'axios'

export default {
  data() {
    return {
      loadedData: null,
      loading: false,
      filter: {}
    }
  },

  created() {
    // Initialize data after component was created and the data is already being
    // observed.
    if (this.shouldReload) {
      this.reloadData()
    } else {
      this.initData()
    }
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
    getEndpoint(method, type, id) {
      return this.api.endpoints[method][type](
        this.viewSchema,
        this.formSchema,
        type === 'collection' ? this.parentFormComponent : id
      )
    },

    getItemId(item, index) {
      return String(this.viewSchema.nested ? index : item.id)
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
      if (this.endpoint) {
        if (clear) {
          this.loadedData = null
        }
        // LoopBack specific filters / query parameters:
        const paginate = this.schema.paginate
        const filter = {
          ...this.filter,
          limit: paginate
        }
        // Only pass on params and filter if it actually contains any keys
        const params = (paginate || Object.keys(filter).length) && {
          filter,
          count: paginate > 0
        }
        this.request('get', this.endpoint, params, null, (error, data) => {
          if (!error) {
            this.setData(data)
          }
        })
      }
    },

    setLoading(loading) {
      this.appState.loading = this.loading = loading
    },

    request(method, path, params, payload, callback) {
      const request = this.api.request || this.requestAxios
      this.errors.remove('dito-request')
      this.setLoading(true)
      request(method, path, params, payload, (error, response) => {
        setTimeout(() => {
          this.setLoading(false)
          if (error) {
            this.errors.add('dito-request', error.toString())
          }
          if (response) {
            // TODO: Deal with / pass on status!
            console.log(response.status, response.data)
          }
          if (callback) {
            callback(error, response && response.data)
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
        .catch(error => callback(error))
    }
  }
}
