import axios from 'axios'

// Assumes: Component defines this.api

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
    shouldLoad() {
      return true
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
      return this.api.endpoints[method][type](this.viewDesc, this.formDesc,
        type === 'collection' ? this.parentFormComponent : id)
    },

    isTransient(item) {
      return item && /^_/.test(item.id)
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
        this.request('get', this.endpoint, params, null, (err, data) => {
          if (!err) {
            this.setData(data)
          }
        })
      }
    },

    setLoading(loading) {
      this.appState.loading = this.loading = loading
    },

    async request(method, path, params, payload, callback) {
      const request = this.api.request || this.requestAxios
      this.errors.remove('dito-data')
      this.setLoading(true)
      request(method, path, params, payload, (err, result) => {
        this.setLoading(false)
        if (err) {
          this.errors.add('dito-data', err.toString())
        }
        if (callback) {
          callback.call(this, err, result)
        }
      })
    },

    async requestAxios(method, path, params, payload, callback) {
      const config = {
        baseURL: this.api.baseURL,
        headers: this.api.headers || {
          'Content-Type': 'application/json'
        },
        params
      }

      try {
        const response = /^(post|put|patch)$/.test(method)
          ? await axios[method](path, JSON.stringify(payload), config)
          : await axios[method](path, config)
        // TODO: Deal with / pass on status!
        console.log(response.status, response.data)
        callback(null, response.data)
      } catch (err) {
        callback(err)
      }
    }
  }
}
