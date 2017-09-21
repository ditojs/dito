import axios from 'axios'
import {isObject} from '@/utils'

export default {
  data() {
    return {
      loadedData: null,
      loading: false
    }
  },

  created() {
    // Give other mixins the change to receive created() events first, e.g.
    // ListMixin to set up filters:
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
    getEndpointPath(method, endpoint) {
      const { type, id } = endpoint
      return this.api.endpoints[method][type](
        this.viewSchema,
        this.formSchema,
        type === 'collection' ? this.parentFormComponent : id
      )
    },

    getItemId(item, index) {
      return String(this.isTransient ? index : item.id)
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
          // See DitoMixin for an explanation of `store.count` & co.
          this.setStore('count', 0)
        }
        // LoopBack specific filters / query parameters:
        const {paginate} = this.viewSchema
        const filter = {
          ...this.filter,
          limit: paginate
        }
        // Only pass on params and filter if it actually contains any keys
        const params = (paginate || Object.keys(filter).length) && {
          filter,
          count: paginate > 0
        }

        this.request('get', { params }, (err, response) => {
          if (!err) {
            let {data} = response
            if (this.endpoint.type === 'collection' && isObject(data)) {
              this.setStore('count', data.count)
              data = data.data
            }
            this.setData(data)
          }
        })
      }
    },

    setLoading(loading) {
      this.appState.loading = this.loading = loading
    },

    request(method, options, callback) {
      const request = this.api.request || this.requestAxios
      const { endpoint, params, payload } = options
      const path = this.getEndpointPath(method, endpoint || this.endpoint)
      this.errors.remove('dito-request')
      this.setLoading(true)
      request(method, path, params, payload, (err, response) => {
        setTimeout(() => {
          this.setLoading(false)
          // Do not report validation errors as dito-request errors
          if (err && !(callback && response && response.status === 422)) {
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
