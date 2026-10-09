import { markRaw } from 'vue'
import ItemMixin from './ItemMixin.js'
import { initializeData } from '../utils/schema/data.js'
import {
  assignDeeply,
  deprecate,
  isObject,
  isString,
  labelize
} from '@ditojs/utils'
import { getResource } from '../utils/resource.js'
import { transferUids } from '../utils/uid.js'
import { LoadingTracker, LoadingSwitch } from '../utils/LoadingTracker.js'
import DitoContext from '../DitoContext.js'

// @vue/component
export default {
  mixins: [ItemMixin],

  provide() {
    return {
      $resourceComponent: () => this,
      // Pass local verbs overrides on to children, see verbs() computed prop.
      $verbs: () => this.verbs,
      $isPopulated: () => this.hasData
    }
  },

  data() {
    // Tracks the pending requests of the component, see `handleRequest()`,
    // and forwards them to the tracker of the enclosing scope, e.g. a view.
    const loadingTracker = new LoadingTracker(this.$loadingTracker())
    return {
      loadedData: null,
      // The abort controller of the pending data load, see `requestData()`.
      loadAbortController: null,
      loadingTracker: markRaw(loadingTracker),
      // The loading operation of the deprecated `setLoading()`.
      setLoadingSwitch: markRaw(new LoadingSwitch(loadingTracker))
    }
  },

  computed: {
    // Whether the component is part of a form, e.g. a list that loads its own
    // data, unlike forms and the lists of views.
    isInsideForm() {
      return !this.isForm && !!this.formComponent
    },

    resourceComponent() {
      return this
    },

    isLoading() {
      return this.loadingTracker.isLoading
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
        (
          !this.providesData &&
          !this.linksToView
        ) ||
        form && (
          form.isTransient ||
          form.isCreating
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

  unmounted() {
    // Settle the pending data load without calling its callback, so that
    // nothing is applied to the unmounted component. Other requests, e.g.
    // submits, change data on the server and are completed, so that their
    // outcome is still notified.
    this.loadAbortController?.abort()
    // Don't leave the enclosing scopes loading after the component is gone,
    // see the deprecated `setLoading()`.
    this.setLoadingSwitch.set(false)
  },

  methods: {
    /**
     * @deprecated `isLoading` is tracked by `loadingTracker` now. Use
     * `loadingTracker.begin()` and call the function that it returns, or
     * `loadingTracker.track(callback)` instead.
     */
    setLoading(isLoading) {
      deprecate(
        'setLoading() is deprecated, use `loadingTracker.begin()` or ' +
        '`loadingTracker.track()` instead.'
      )
      // The former `options.updateRoot` and `options.updateView` are ignored,
      // since the tracker forwards its operations to the trackers of the
      // enclosing view and the root anyway.
      this.setLoadingSwitch.set(isLoading)
    },

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

    // Sets the loaded data and returns it as the reactive data of the
    // component, which can be modified to update it.
    // @overridable
    setData(data) {
      this.loadedData = data
      return this.loadedData
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
      return initializeData(schema, type ? { type } : {}, this)
    },

    requestData() {
      const query = this.queryParams
      return this.handleRequest(
        { method: 'get', query, isDataLoad: true },
        async (err, response) => {
          if (err) {
            if (response) {
              const { data } = response
              if (
                data?.type === 'FilterValidation' &&
                this.onFilterErrors?.(data.errors)
              ) {
                return true
              } else if (
                this.isUnauthorizedError(response) &&
                this.isInsideForm
              ) {
                // The user is logged in, see `sendRequest()`, but may not
                // access the resource of a component in a form, e.g. a list
                // that loads its own data. Show it on the component, as
                // several components of the form may be affected. Others
                // notify like for errors.
                this.addUnauthorizedError()
                return true
              }
            }
          } else {
            // Skip applying response data on a dirty form: `setData` would
            // wholesale-replace `loadedData` and clobber any local edits the
            // user made while the GET was in flight. The `'load'` event still
            // fires — the GET *did* complete; we just chose not to apply it.
            if (!(this.isForm && this.isDirty)) {
              this.setData(response.data)
            }
            // Await the handlers, so that their errors are notified below.
            await this.emitSchemaEvent('load')
          }
        }
      ).catch(error => {
        // Notify the errors thrown while applying the loaded data, e.g. by
        // `setData()` or the `'load'` event handlers, which the emitter
        // aggregates, like request errors. Aborted loads don't call the
        // callback, see `handleRequest()`.
        const errors = error instanceof AggregateError ? error.errors : [error]
        for (const err of errors) {
          this.notifyRequestError(err)
        }
      })
    },

    isValidationError(response) {
      return response?.status === 400
    },

    isUnauthorizedError(response) {
      return response?.status === 401
    },

    addUnauthorizedError() {
      const error = `You don't have permission to load this data.`
      if (!this.errors?.includes(error)) {
        this.addError(error)
      }
    },

    // Sends the request and awaits `callback(error, response)` with its
    // outcome. If the callback returns `true` for an error, the error was
    // handled, otherwise it is notified. Errors that the callback throws are
    // passed on to the caller. Aborted requests settle without calling the
    // callback: Each data load aborts the previous one, see `requestData()`,
    // and unmounting aborts the pending one. Other requests, e.g. submits,
    // aren't aborted.
    async handleRequest(
      {
        method,
        resource = this.getResource({ method }),
        query,
        data,
        isDataLoad = false
      },
      callback
    ) {
      const controller = new AbortController()
      if (isDataLoad) {
        this.loadAbortController?.abort()
        this.loadAbortController = controller
      }
      const endLoading = this.loadingTracker.begin()
      method = resource.method || method
      let response = null
      let error = null
      try {
        response = await this.sendRequest({
          method,
          resource,
          query,
          data,
          signal: controller.signal
        })
      } catch (err) {
        error = err
      } finally {
        if (this.loadAbortController === controller) {
          this.loadAbortController = null
        }
        endLoading()
      }
      if (controller.signal.aborted || error?.name === 'AbortError') {
        return
      }
      if (error) {
        const { response } = error
        // If the callback returns true, the error was already handled.
        if (!(await callback(error, response))) {
          this.notifyRequestError(error)
        }
      } else {
        // Pass both request and response to the callback, so they can be
        // exposed to further callbacks through DitoContext.
        await callback(null, response)
      }
    },

    // Notifies the error with the type and message of the response data of
    // request errors, see `RequestError`, or else the error itself.
    notifyRequestError(error) {
      const data = error?.response?.data
      const title = isString(data?.type) ? labelize(data.type) : 'Error'
      const text = data?.message ?? error
      this.notify({ type: 'error', error, title, text })
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
      // Resolves to `false` for errors.
      let isSuccessful = false
      await this.handleRequest(
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
            return true // The error was handled.
          } else {
            // Update the underlying data before calling `notify()` or
            // `this.itemLabel`, so id is set after creating new items.
            if (setData && data) {
              // Preserve the foreign data entries when updating the data.
              const { foreignData } = this.mainSchemaComponent.filterData(
                this.data
              )
              const savedData = assignDeeply({}, foreignData, data)
              // Keep the uids of new items, which key their components and
              // stores, see `transferUids()`.
              transferUids(this.data, savedData)
              this.setData(savedData)
            }
            onSuccess?.()
            await this.emitButtonEvent(button, 'success', {
              notify: notifySuccess
            })
            isSuccessful = true
          }
        }
      )
      return isSuccessful
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
