import axios from 'axios'

// Assumes: Component defines this.api

export default {
  data() {
    return {
      error: null,
      loading: false,
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
    goBack(reload) {
      this.$router.push({ path: '..', append: true })
      // Tell the parent to reload its data if this was a submit()
      const parent = this.parentRouteComponent
      if (reload && parent) {
        parent.reloadData()
      }
    },

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

    reloadData() {
      this.loadData(false)
    },

    loadData(clear) {
      if (this.endpoint) {
        if (clear) {
          this.loadedData = null
        }
        this.request('get', this.endpoint, null, (err, data) => {
          if (!err) {
            this.setData(data)
          }
        })
      }
    },

    setLoading(loading) {
      // Only display loading progress on route components
      this.routeComponent.loading = loading
    },

    request(method, path, payload, callback) {
      const request = this.api.request || this.requestAxios
      this.error = null
      this.setLoading(true)
      request(method, path, payload, (err, result) => {
        this.setLoading(false)
        if (err) {
          this.error = err.toString()
        }
        if (callback) {
          callback.call(this, err, result)
        }
      })
    },

    requestAxios(method, path, payload, callback) {
      // TODO: implement pass through of query strings / params
      // params: params
      axios[method](this.api.baseUrl + path, payload && JSON.stringify(payload))
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
