import axios from 'axios'

export default {
  data() {
    return {
      loadedData: null,
      loading: false
    }
  },

  created() {
    // Initialize data after component was created and the data is already being
    // observed.
    this.initData()
  },

  computed: {
    isTransient() {
      const parent = this.parentFormComponent
      return parent && (parent.isTransient || parent.create)
    },

    isEmbedded() {
      return !!this.viewDesc.embedded
    },

    isPersistable() {
      return !(this.isTransient || this.isEmbedded)
    },

    shouldLoad() {
      return this.isPersistable
    },

    verbCreate() {
      return this.isPersistable ? 'create' : 'add'
    },

    verbEdit() {
      return 'edit'
    },

    verbSave() {
      return this.isPersistable ? 'save' : 'apply'
    },

    verbDelete() {
      return this.isPersistable ? 'delete' : 'remove'
    }
  },

  watch: {
    $route() {
      if (this.isLastDataRoute) {
        // Execute in next tick so implementing components can also watch $route
        // and handle changes that affect initData(), e.g. in DitoView.
        this.$nextTick(function() {
          this.initData()
        })
      }
    }
  },

  methods: {
    getEndpoint(method, type, id) {
      return this.api.endpoints[method][type](
        this.viewDesc,
        this.formDesc,
        type === 'collection' ? this.parentFormComponent : id
      )
    },

    getItemId(item, index) {
      return String(this.viewDesc.embedded ? index : item.id)
    },

    setData(data) {
      this.loadedData = data
    },

    initData() {
      if (this.shouldLoad) {
        this.loadData(true)
      }
    },

    reloadData(params) {
      this.loadData(false, params)
    },

    loadData(clear, params) {
      if (this.endpoint) {
        if (clear) {
          this.loadedData = null
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
      this.errors.remove('dito-data')
      this.setLoading(true)
      request(method, path, params, payload, (error, response) => {
        this.setLoading(false)
        if (error) {
          this.errors.add('dito-data', error.toString())
        }
        if (response) {
          // TODO: Deal with / pass on status!
          console.log(response.status, response.data)
        }
        if (callback) {
          callback(error, response && response.data)
        }
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
