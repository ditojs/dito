import axios from 'axios'

// Assumes: Component defines this.api

export default {
  data() {
    return {
      loadedData: null
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
      if (this.isLastRoute) {
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

    request(method, path, params, payload, callback) {
      const request = this.api.request || this.requestAxios
      this.errors.remove('dito-data')
      this.appState.loading = true
      request(method, path, params, payload, (err, result) => {
        this.appState.loading = false
        if (err) {
          this.errors.add('dito-data', err.toString())
        }
        if (callback) {
          callback.call(this, err, result)
        }
      })
    },

    requestAxios(method, path, params, payload, callback) {
      // TODO: move params into config and pass after payload
      axios[method](this.api.baseUrl + path, params,
          payload && JSON.stringify(payload))
        .then(response => {
          // TODO: Deal with status!
          console.log(response.status)
          callback(null, response.data)
        })
        .catch(error => {
          callback(error)
        })
    }
  }
}
