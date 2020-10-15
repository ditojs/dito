import ItemMixin from './ItemMixin'
import LoadingMixin from './LoadingMixin'
import { setDefaults } from '@/utils/schema'
import { isObject, isString, labelize } from '@ditojs/utils'
import { getResource } from '@/utils/resource'

// @vue/component
export default {
  mixins: [ItemMixin, LoadingMixin],

  provide() {
    return {
      $resourceComponent: () => this,
      // Pass local verbs overrides on to children, see verbs() computed prop.
      $verbs: () => this.verbs,
      $isPopulated: () => this.hasData
    }
  },

  data() {
    return {
      loadedData: null
    }
  },

  computed: {
    resourceComponent() {
      return this
    },

    resource() {
      // Returns the resource object representing the resource for the
      // associated source schema.
      return this.getResource()
    },

    providesData() {
      // This component is a data-source if it has an associated API resource:
      return !!this.resource
    },

    isTransient() {
      // Check the form that this component belongs to as well, since it may be
      // in creation mode, which makes it transient.
      // NOTE: This does not loop endlessly because DitoForm redefines
      // `isTransient()` to only return `!this.providesData`.
      const form = this.formComponent
      return (
        !this.providesData ||
        form && (
          form.isTransient ||
          form.isCreating
        )
      )
    },

    transientNote() {
      return (
        this.isTransient &&
        '<b>Note</b>: the parent still needs to be saved ' +
        'in order to persist this change.'
      )
    },

    shouldLoad() {
      return (
        !this.isTransient &&
        !this.isLoading
      )
    },

    // @overridable
    hasData() {
      // Base definition, will be overridden by DitoForm and SourceMixin
      return !!this.loadedData
    },

    verbs() {
      // The actual code is the `getVerbs()` method, for easier overriding of
      // this computed property in components that use the ResourceMixin.
      return this.getVerbs()
    },

    paginationRange() {
      // Only apply pagination to lists.
      const { paginate: amount } = this.sourceSchema
      if (this.isListSource && amount) {
        const { page = 0 } = this.query || {}
        const start = page * amount
        return [start, start + amount - 1]
      }
    },

    queryParams() {
      const range = this.paginationRange
      const { page, ...query } = this.query || {}
      return {
        ...query, // Query may override scope.
        ...(range && {
          // Pass pagination as range, so that we automatically get Objection's
          // results counting:
          range: range.join(',')
        })
      }
    }
  },

  created() {
    // When creating nested data, we still need to call setupData()
    if (this.providesData || this.isCreating) {
      this.setupData()
    }
  },

  methods: {
    getResource() {
      // This is defined as a method so the computed `resource` getter can
      // be overridden and `super` functionality can still be accessed.
      return getResource(this.sourceSchema?.resource, {
        type: 'collection',
        parent: this.parentFormComponent?.resource ?? null
      })
    },

    getVerbs() {
      const verbs = this.$verbs()
      return this.isTransient
        ? {
          ...verbs,
          // Override default verbs with their transient versions:
          create: 'add',
          created: 'added',
          save: 'apply',
          saved: 'applied',
          delete: 'remove',
          deleted: 'removed'
        }
        : verbs
    },

    // @overridable
    clearData() {
      this.loadedData = null
    },

    // @overridable
    setData(data) {
      this.loadedData = data
    },

    setupData() {
      // Actual code is in separate function so it's easer to override
      // `setupData()` and and call `ensureData()` from the overrides,
      // see DitoForm and SourceMixin.
      this.ensureData()
    },

    ensureData() {
      if (this.shouldLoad) {
        if (this.hasData) {
          this.reloadData()
        } else {
          this.loadData(true)
        }
      }
    },

    reloadData() {
      this.loadData(false)
    },

    loadData(clear) {
      if (!this.isTransient) {
        if (clear) {
          this.clearData()
        }
        this.requestData()
      }
    },

    createData(schema, type) {
      return setDefaults(schema, type ? { type } : {})
    },

    requestData() {
      const params = this.queryParams
      this.handleRequest({ method: 'get', params }, (err, response) => {
        if (err) {
          if (response) {
            const { data } = response
            if (
              data?.type === 'FilterValidation' &&
              this.onFilterErrors?.(data.errors)) {
              return true
            } else if (this.isUnauthorizedError(response)) {
              // TODO: Can we really swallow these errors?
              // Is calling `ensureUser()` in `onBeforeRequest()` enough?
              return true
            }
          }
        } else {
          this.setData(response.data)
        }
      })
    },

    isValidationError(response) {
      return response?.status === 400
    },

    isUnauthorizedError(response) {
      return response?.status === 401
    },

    async handleRequest({
      method,
      resource = this.resource,
      data,
      params
    }, callback) {
      const loadingSettings = {
        updateRoot: true, // Display spinner in header when loading in resources
        updateView: this.isInView // Notify view of loading for view components
      }
      this.setLoading(true, loadingSettings)
      const request = { method, resource, data, params }
      try {
        const response = await this.sendRequest(request)
        // Pass both request and response to the callback, so they can be
        // exposed to further callbacks through ItemContext.
        callback(null, response)
      } catch (error) {
        // If callback returns true, errors were already handled.
        const { response } = error
        if (!callback(error, response)) {
          const data = response?.data
          if (data && isString(data.type)) {
            this.notify('error', labelize(data.type), data.message || error)
          } else {
            this.notify('error', 'Request Error', error)
          }
        }
      }
      this.setLoading(false, loadingSettings)
    },

    getPayloadData(button, method) {
      // Convention: only post and patch requests pass the data as payload.
      return (
        ['post', 'patch'].includes(method) && (
          button.getSchemaValue(['resource', 'data']) ||
          button.processedItem
        )
      )
    },

    async submit(button) {
      const resource = getResource(button.schema.resource, {
        parent: this.resource
      })
      if (resource) {
        const { method } = resource
        const data = this.getPayloadData(button, method)
        return this.submitResource(button, resource, method, data)
      }
      return false
    },

    async submitResource(button, resource, method, data, {
      setData = false,
      notifySuccess = () => this.notify(
        'success',
        'Request Successful',
        'Request was successfully sent.'
      ),
      notifyError = error => this.notify(
        'error',
        'Request Error',
        `Unable to send request${error ? ':' : ''}`,
        error?.message || error
      )
    } = {}) {
      return new Promise(resolve => {
        this.handleRequest(
          { method, data, resource },
          async (err, response) => {
            const data = response?.data
            if (err) {
              // See if we're dealing with a Dito validation error:
              const errors = this.isValidationError(response) && data.errors
              if (errors) {
                this.showValidationErrors(errors, true)
              } else {
                const error = isObject(data) ? data : err
                await this.emitButtonEvent(button, 'error', {
                  notify: notifyError,
                  error
                })
              }
              resolve(false)
            } else {
              // Update the underlying data before calling `notify()` or
              // `this.itemLabel`, so id is set after creating new items.
              if (setData && data) {
                this.setData(data)
              }
              await this.emitButtonEvent(button, 'success', {
                notify: notifySuccess
              })
              resolve(true)
            }
          }
        )
      })
    },

    // `emitButtonEvent()` returns `true` when the default is not
    //
    async emitButtonEvent(button, event, { notify, error }) {
      // Compare notification-count before/after the event to determine if a
      // notification was already displayed, or if notify() should be called.
      const { notificationCount } = this.rootComponent
      const res = await button.emitEvent(event, {
        params: {
          data: this.data,
          itemLabel: this.itemLabel,
          error
        }
      })
      if (
        notify &&
        // Prevent default if anything was returned from the event handler.
        res === undefined &&
        // Do not display default notification if the event handler already
        // displayed a notification.
        this.rootComponent.notificationCount === notificationCount
      ) {
        notify(error)
      }
      return res
    }
  }
}
