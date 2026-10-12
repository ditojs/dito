import { computed, markRaw, onUnmounted, shallowRef } from 'vue'
import { isObject, isString, labelize } from '@ditojs/utils'
import defaultVerbs from '../verbs.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { getErrorMessage } from '../utils/request.js'
import { LoadingTracker } from '../utils/LoadingTracker.ts'
import { sendRequest, type Services } from '../utils/services.ts'
import type {
  ResourceOptions,
  SubmitButton
} from '../utils/ResourceContext.ts'
import type { RouteContext } from '../utils/RouteContext.ts'
import type { Data, Resource, Schema } from '../utils/types.ts'
import type { HTTPMethod } from '../../types/index.d.ts'

export interface RequestHandlerOptions {
  method: HTTPMethod
  resource?: Resource | null
  query?: Record<string, any>
  data?: any
  isDataLoad?: boolean
}

export interface SubmitResourceOptions {
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  notifySuccess?: () => void
  notifyError?: (error: any) => void
}

export interface UseResourceOptions {
  services: Services
  // The route of sources, and the parent route of forms:
  parentRoute: RouteContext | null
  getSchema(): Schema
  getItemId?: () => string | null
  isTransient(providesData: boolean): boolean
  hasData(): boolean
  clearData(): void
  setLoadedData(data: any): void
  getQuery?: () => Record<string, any>
  // The pending navigation to a changed query, which the load waits for:
  whenQueryNavigated?: () => Promise<boolean> | null
  // Handle the error of a load, and return whether it was handled:
  handleLoadError?: (response: any) => boolean
  emitLoad(): Promise<unknown>
  // The data and item label that the events of submit buttons receive:
  getData(): Data | null
  getItemLabel?: () => string | null
  showValidationErrors(errors: Record<string, any>): Promise<unknown>
}

// Load and submit the data of a form or source through its resource, tracking
// the requests in the loading state of the component and its view.
export function useResource({
  services,
  parentRoute,
  getSchema,
  getItemId,
  isTransient: getIsTransient,
  hasData,
  clearData,
  setLoadedData,
  getQuery = () => ({}),
  whenQueryNavigated,
  handleLoadError,
  emitLoad,
  getData,
  getItemLabel = () => null,
  showValidationErrors
}: UseResourceOptions) {
  const { admin } = services
  const loadingTracker = markRaw(
    new LoadingTracker(parentRoute?.loadingTracker ?? admin.loadingTracker)
  )
  const loadAbortController = shallowRef<AbortController | null>(null)

  const getOwnResource = ({ method = 'get', child }: ResourceOptions = {}) => {
    const { resource } = getSchema()
    const collection = getResource(resource, {
      type: 'collection',
      method,
      parent: (
        parentRoute?.resource?.getResource({ method, child: resource }) ?? null
      ),
      child
    })
    return getMemberResource(getItemId?.(), collection) || collection
  }

  const providesData = computed(() => !!getOwnResource())
  const isTransient = computed(() => getIsTransient(providesData.value))
  const isLoading = computed(() => loadingTracker.isLoading)
  let isUnmounted = false

  // Continue the verbs of the parent, with the transient ones in nested data:
  const verbs = computed(() => {
    const parentVerbs = parentRoute?.resource?.verbs ?? defaultVerbs
    return isTransient.value
      ? {
          ...parentVerbs,
          create: 'add',
          created: 'added',
          save: 'apply',
          saved: 'applied',
          delete: 'remove',
          deleted: 'removed'
        }
      : parentVerbs
  })

  // Notify request errors with the type and message of their response data:
  const notifyRequestError = (error: any) => {
    const data = error?.response?.data
    const title = isString(data?.type) ? labelize(data.type) : 'Error'
    const text = data?.message ?? error
    admin.notify({ type: 'error', error, title, text })
  }

  // Errors are notified unless `callback()` returns `true`. Aborted requests
  // settle without calling it: Each data load aborts the previous one, and
  // unmounting aborts the pending one.
  const handleRequest = async (
    {
      method,
      resource = getOwnResource({ method }),
      query,
      data,
      isDataLoad = false
    }: RequestHandlerOptions,
    callback: (error: any, response: any) => any
  ) => {
    const controller = new AbortController()
    if (isDataLoad) {
      loadAbortController.value?.abort()
      loadAbortController.value = controller
    }
    const endLoading = loadingTracker.begin()
    let response = null
    let error: any = null
    try {
      response = await sendRequest(services, {
        method: resource?.method || method,
        resource: resource ?? undefined,
        query,
        data,
        signal: controller.signal
      })
    } catch (err) {
      error = err
    } finally {
      if (loadAbortController.value === controller) {
        loadAbortController.value = null
      }
      endLoading()
    }
    if (!controller.signal.aborted && error?.name !== 'AbortError') {
      if (error) {
        if (!(await callback(error, error.response))) {
          notifyRequestError(error)
        }
      } else {
        await callback(null, response)
      }
    }
  }

  const requestData = (): Promise<void> => {
    // While navigating to a changed query, the route watcher loads the list.
    // Only load here if the navigation failed or was superseded:
    const navigated = whenQueryNavigated?.()
    return navigated
      ? navigated.then(hasNavigated => {
          if (!hasNavigated && !isUnmounted) {
            return requestData()
          }
        })
      : handleRequest(
          { method: 'get', query: getQuery(), isDataLoad: true },
          async (err, response) => {
            if (err) {
              return !!response && !!handleLoadError?.(response)
            } else {
              setLoadedData(response.data)
              // Await the handlers, so that their errors are notified below.
              await emitLoad()
            }
          }
        ).catch(error => {
          // The emitter aggregates the errors of the `load` handlers:
          const errors =
            error instanceof AggregateError ? error.errors : [error]
          for (const err of errors) {
            notifyRequestError(err)
          }
        })
  }

  const loadData = (clear: boolean) => {
    if (!isTransient.value) {
      if (clear) {
        clearData()
      }
      return requestData()
    }
  }

  // Abort only the pending data load, as other requests, e.g. submits, change
  // data on the server and their outcome needs to be notified:
  onUnmounted(() => {
    isUnmounted = true
    loadAbortController.value?.abort()
  })

  // Emit the event of the button, and call `notify()` unless its handlers
  // returned a value or notified themselves:
  const emitButtonEvent = async (
    button: SubmitButton,
    event: string,
    { notify, error }: { notify?: (error?: any) => void; error?: any }
  ) => {
    const context = button.createContext({
      nested: false,
      data: getData(),
      itemLabel: getItemLabel(),
      error
    })
    const res = await button.emitEvent(event, { context })
    if (notify && res === undefined && !context.wasNotified) {
      notify(error)
    }
    return res
  }

  return {
    loadingTracker,
    loadAbortController,
    isLoading,
    providesData,
    isTransient,
    verbs,
    getResource: getOwnResource,
    handleRequest,
    loadData,
    emitButtonEvent,

    reloadData() {
      loadData(false)
    },

    ensureData() {
      if (!isTransient.value && !isLoading.value) {
        loadData(!hasData())
      }
    },

    // Only post, put and patch requests pass the data as payload:
    getPayloadData(button: SubmitButton, method: HTTPMethod) {
      return (
        ['post', 'put', 'patch'].includes(method) && (
          button.getSchemaValue(['resource', 'data']) ||
          button.context.processedItem
        )
      )
    },

    // Resolve to whether the request succeeded:
    async submitResource(
      button: SubmitButton,
      resource: Resource,
      method: HTTPMethod,
      data: any,
      {
        onSuccess,
        onError,
        notifySuccess = () =>
          admin.notify({
            type: 'success',
            title: 'Request Successful',
            text: 'Request was successfully sent.'
          }),
        notifyError = error => {
          const message = getErrorMessage(error)
          admin.notify({
            type: 'error',
            error,
            title: 'Request Error',
            text: message
              ? ['Unable to send request:', message]
              : 'Unable to send request.'
          })
        }
      }: SubmitResourceOptions = {}
    ) {
      let isSuccessful = false
      await handleRequest(
        { method, resource, data },
        async (err, response) => {
          const data = response?.data
          if (err) {
            // Dito.js validation errors are shown on the fields:
            const errors = response?.status === 400 && data.errors
            if (errors) {
              await showValidationErrors(errors)
            } else {
              const error = isObject(data) ? data : err
              onError?.(error)
              await emitButtonEvent(button, 'error', {
                notify: notifyError,
                error
              })
            }
            return true // The error was handled.
          } else {
            // Forms merge the id of created items in `onSuccess()`, before the
            // notification reads the item label:
            onSuccess?.(data)
            await emitButtonEvent(button, 'success', { notify: notifySuccess })
            isSuccessful = true
          }
        }
      )
      return isSuccessful
    }
  }
}
