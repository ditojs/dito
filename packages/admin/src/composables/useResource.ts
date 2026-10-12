import { computed, markRaw, onUnmounted, shallowRef } from 'vue'
import { isString, labelize } from '@ditojs/utils'
import defaultVerbs from '../verbs.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { LoadingTracker } from '../utils/LoadingTracker.ts'
import { sendRequest, type Services } from '../utils/services.ts'
import type { ResourceOptions } from '../utils/ResourceContext.ts'
import type { RouteContext } from '../utils/RouteContext.ts'
import type { Resource, Schema } from '../utils/types.ts'
import type { HTTPMethod } from '../../types/index.d.ts'

type Callback = (error: any, response: any) => any

export interface RequestHandlerOptions {
  method: HTTPMethod
  resource?: Resource | null
  query?: Record<string, any>
  data?: any
  isDataLoad?: boolean
}

export interface UseResourceOptions {
  services: Services
  // The route that renders sources, and the parent route of forms, which the
  // resource continues and whose loading tracker it forwards to:
  parentRoute: RouteContext | null
  // The schema with the `resource`, and the id of the item that forms edit in
  // its collection:
  getSchema(): Schema
  getItemId?: () => string | null
  isTransient(providesData: boolean): boolean
  hasData(): boolean
  clearData(): void
  setLoadedData(data: any): void
  // The query to load the data with, e.g. of lists:
  getQuery?: () => Record<string, any>
  // The pending navigation to a changed query, which the load waits for, see
  // `ListQuery.whenNavigated()`:
  whenQueryNavigated?: () => Promise<boolean> | null
  // Handle the error of a load, and return whether it was handled:
  handleLoadError?: (response: any) => boolean
  emitLoad(): Promise<unknown>
}

// Load the data of a form or source through its resource, and send its
// requests, tracking them in the loading state of the component and its view.
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
  emitLoad
}: UseResourceOptions) {
  const { admin } = services
  const loadingTracker = markRaw(
    new LoadingTracker(parentRoute?.loadingTracker ?? admin.loadingTracker)
  )
  // The abort controller of the pending data load, see `requestData()`:
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

  // Notify the error with the type and message of the response data of request
  // errors, see `RequestError`, or else the error itself:
  const notifyRequestError = (error: any) => {
    const data = error?.response?.data
    const title = isString(data?.type) ? labelize(data.type) : 'Error'
    const text = data?.message ?? error
    admin.notify({ type: 'error', error, title, text })
  }

  // Send the request and await `callback(error, response)` with its outcome.
  // If the callback returns `true` for an error, the error was handled,
  // otherwise it is notified. Errors that the callback throws are passed on to
  // the caller. Aborted requests settle without calling the callback: Each
  // data load aborts the previous one, and unmounting aborts the pending one.
  // Other requests, e.g. submits, aren't aborted.
  const handleRequest = async (
    {
      method,
      resource = getOwnResource({ method }),
      query,
      data,
      isDataLoad = false
    }: RequestHandlerOptions,
    callback: Callback
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
    // While a navigation to a changed query is pending, the query is stale, and
    // the source loads its list once the route changed. Only load if the
    // navigation failed or was superseded:
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
          // Notify the errors thrown while applying the loaded data, e.g. by
          // the `load` event handlers, which the emitter aggregates:
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

  // Settle the pending data load without calling its callback, so that nothing
  // is applied to the unmounted component. Other requests, e.g. submits,
  // change data on the server and are completed, so their outcome is notified.
  onUnmounted(() => {
    isUnmounted = true
    loadAbortController.value?.abort()
  })

  return {
    loadingTracker,
    loadAbortController,
    isLoading,
    providesData,
    isTransient,
    verbs,
    getResource: getOwnResource,
    handleRequest,
    notifyRequestError,
    requestData,
    loadData,

    reloadData() {
      loadData(false)
    },

    // Load the data, unless it's transient or already loading:
    ensureData() {
      if (!isTransient.value && !isLoading.value) {
        loadData(!hasData())
      }
    }
  }
}

export type ResourceRequests = ReturnType<typeof useResource>
