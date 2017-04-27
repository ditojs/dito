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
      return this.api.endpoints[method][type](this.view, this.form,
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
        this.send('get', this.endpoint, null, (err, data) => {
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

    send(method, path, payload, callback) {
      // TODO: Shall we fall back to axios locally imported, if no send method
      // is defined?
      // COMMENT WILM: It might be good to just implement send here completely?
      // The 'fakeDb' flag is just used for dev right now, should go in the future

      this.error = null

      const send = this.api.fakeDb
        ? this.api.send
        : this.request

      if (send) {
        this.setLoading(true)
        send(method, path, payload, (err, result) => {
          this.setLoading(false)
          if (err) {
            this.error = err.toString()
          }
          if (callback) {
            callback.call(this, err, result)
          }
        })
        return true
      }
    },

    request(method, path, payload, callback) {
      const url = this.api.baseUrl + path

      if (method === 'get') {
        let item
        let err
        axios.get(url)
          .then(response => {
            item = response.data
          })
          .catch(error => {
            err = error
          })
        callback(err, item)
      }
    }
  }
}
