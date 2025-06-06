import ItemMixin from './ItemMixin.js'
import LoadingMixin from './LoadingMixin.js'
import { setDefaultValues } from '../utils/schema.js'
import { assignDeeply, isObject, isString, labelize } from '@ditojs/utils'
import { getResource } from '../utils/resource.js'
import DitoContext from '../DitoContext.js'

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
      loadedData: null,
      abortController: null
    }
  },

  computed: {
    resourceComponent() {
      return this
    },

    resource() {
      return this.getResource()
    },

    providesData() {
      // This component is a data-source if it has an associated API resource:
      return !!this.resource
    },

    linksToView() {
      // Returns `false`here, but is overridden to return `true` in
      // `SourceMixin` for component that do not provide their own data, but
      // edit their items through a linked view.  In this case, real ids need to
      // be used.
      return false
    },

    isTransient() {
      // Check the form that this component belongs to as well, since it may be
      // in creation mode, which makes it transient.
      // NOTE: This does not loop endlessly because DitoForm redefines
      // `isTransient()` to only return `!this.providesData`.
      const form = this.formComponent
      return (
        !this.providesData &&
        !this.linksToView ||
        form && (
          form.isTransient ||
          form.isCreating
        )
      )
    },

    transientNote() {
      return (
        this.isTransient && (
          '<b>Note</b>: the parent still needs to be saved ' +
          'in order to persist this change.'
        )
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
      return null
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
    getResource({ method = 'get', child } = {}) {
      // Returns the resource object representing the resource for the
      // associated source schema.
      const resource = this.sourceSchema?.resource
      return getResource(resource, {
        type: 'collection',
        method,
        parent: this.parentResourceComponent?.getResource({
          method,
          child: resource
        }) ?? null,
        child
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
      return setDefaultValues(schema, type ? { type } : {}, this)
    },

    requestData() {
      const query = this.queryParams
      this.handleRequest({ method: 'get', query }, (err, response) => {
        if (err) {
          if (response) {
            const { data } = response
            if (
              data?.type === 'FilterValidation' &&
              this.onFilterErrors?.(data.errors)
            ) {
              return true
            } else if (this.isUnauthorizedError(response)) {
              // TODO: Can we really swallow these errors?
              // Is calling `ensureUser()` in `onBeforeRequest()` enough?
              return true
            }
          }
        } else {
          this.setData(response.data)
          this.emitSchemaEvent('load')
        }
      })
    },

    isValidationError(response) {
      return response?.status === 400
    },

    isUnauthorizedError(response) {
      return response?.status === 401
    },

    async handleRequest(
      {
        method,
        resource = this.getResource({ method }),
        query,
        data
      },
      callback
    ) {
      const loadingOptions = {
        updateRoot: true, // Display spinner in header when loading in resources
        updateView: this.isInView // Notify view of loading for view components
      }
      this.abortController?.abort()
      const controller = new AbortController()
      this.abortController = controller
      const { signal } = controller
      method = resource.method || method
      const request = { method, resource, query, data, signal }
      this.setLoading(true, loadingOptions)
      try {
        const response = await this.sendRequest(request)
        // Pass both request and response to the callback, so they can be
        // exposed to further callbacks through DitoContext.
        callback(null, response)
      } catch (error) {
        if (error.name !== 'AbortError') {
          // If callback returns true, errors were already handled.
          const { response } = error
          if (!callback(error, response)) {
            const data = response?.data
            const title = isString(data?.type)
              ? labelize(data.type)
              : 'Error'
            const text = data?.message ?? error
            this.notify({ type: 'error', error, title, text })
          }
        }
      }
      if (this.abortController === controller) {
        // Only clear the loading state if this is still the current request.
        this.abortController = null
        this.setLoading(false, loadingOptions)
      }
    },

    getPayloadData(button, method) {
      // Convention: only post, put and patch requests pass the data as payload.
      return (
        ['post', 'put', 'patch'].includes(method) && (
          // TODO: Use `handleDataSchema()` asynchronously here instead, to
          // offer the same amount of possibilities for data loading.
          button.getSchemaValue(['resource', 'data']) ||
          button.processedItem
        )
      )
    },

    async submit(button) {
      let { resource } = button.schema
      resource = getResource(resource, {
        parent: this.getResource({
          method: resource?.method,
          child: resource
        })
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
      onSuccess,
      onError,
      notifySuccess = () =>
        this.notify({
          type: 'success',
          title: 'Request Successful',
          text: 'Request was successfully sent.'
        }),
      notifyError = error =>
        this.notify({
          type: 'error',
          error,
          title: 'Request Error',
          text: [
            `Unable to send request${error ? ':' : ''}`,
            error?.message || error
          ]
        })
    } = {}) {
      return new Promise(resolve => {
        this.handleRequest(
          { method, resource, data },
          async (err, response) => {
            const data = response?.data
            if (err) {
              // See if we're dealing with a Dito.js validation error:
              const errors = this.isValidationError(response) && data.errors
              if (errors) {
                await this.showValidationErrors(errors, true)
              } else {
                const error = isObject(data) ? data : err
                onError?.(error)
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
                // Preserve the foreign data entries when updating the data.
                const { foreignData } = this.mainSchemaComponent.filterData(
                  this.data
                )
                // Tell the parent route to reload its data, so that it can
                // update its foreign data entries.
                const parentMeta = this.parentRouteComponent?.routeRecord?.meta
                if (parentMeta) {
                  parentMeta.reload = true
                }
                this.setData(assignDeeply({}, foreignData, data))
              }
              onSuccess?.()
              await this.emitButtonEvent(button, 'success', {
                notify: notifySuccess
              })
              resolve(true)
            }
          }
        )
      })
    },

    async emitButtonEvent(button, event, { notify, error }) {
      // Create the context outside of `emitEvent()`, so that
      // `context.wasNotified` can be checked after.
      const context = new DitoContext(button, {
        nested: false,
        data: this.data,
        itemLabel: this.itemLabel,
        error
      })
      const res = await button.emitEvent(event, { context })
      if (
        notify &&
        // Prevent default if anything was returned from the event handler.
        res === undefined &&
        // Do not display default notification if the event handler already
        // displayed a notification.
        !context.wasNotified
      ) {
        notify(error)
      }
      return res
    }
  }
}
