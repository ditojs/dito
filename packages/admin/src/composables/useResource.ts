import { computed, markRaw, onUnmounted } from 'vue'
import { isObject, isString, labelize } from '@ditojs/utils'
import defaultVerbs from '../verbs.js'
import {
  getResource,
  getMemberResource,
  hasResource
} from '../utils/resource.js'
import { getErrorMessage } from '../utils/request.js'
import { LoadingTracker } from '../utils/LoadingTracker.ts'
import { sendRequest } from '../utils/services.ts'
import type { AdminContext } from '../utils/AdminContext.ts'
import type {
  ResourceContext,
  ResourceOptions,
  SubmitButton
} from '../utils/ResourceContext.ts'
import type { RouteContext } from '../utils/RouteContext.ts'
import type { Schema } from '../utils/types.ts'
import type { ApiResource, HttpMethod } from '../../types/index.d.ts'

export interface RequestHandlerOptions {
  method: HttpMethod
  resource?: ApiResource | null
  query?: Record<string, any>
  data?: any
  isDataLoad?: boolean
}

export interface LoadOptions {
  query?: Record<string, any>
  onLoad(data: any): Promise<unknown>
  // Handle the error response of the load, and return whether it was handled:
  onError?: (response: any) => boolean
}

export interface ButtonEventOptions {
  notify?: (error?: any) => void
  error?: any
}

export interface SubmitResourceOptions {
  // Resolve to `true` to suppress the notification:
  onSuccess?: (data: any) => Promise<boolean> | void
  onError?: (error: any) => Promise<boolean> | void
  notifySuccess?: () => void
  notifyError?: (error: any) => void
  showValidationErrors(errors: Record<string, any>): Promise<unknown>
}

// Load and submit the data of a form or source through its resource, which
// continues `parentResourceContext`, tracking the requests in the loading
// state of the component and of the route.
export function useResource({
  adminContext,
  parentResourceContext,
  parentRouteContext,
  getSchema,
  getItemId = () => null,
  isTransient: getIsTransient
}: {
  adminContext: AdminContext
  parentResourceContext: ResourceContext | null
  // The route of sources, and the parent route of forms:
  parentRouteContext: RouteContext | null
  getSchema(): Schema
  getItemId?: () => string | null
  isTransient(providesData: boolean): boolean
}) {
  const loadingTracker = markRaw(
    new LoadingTracker(
      parentRouteContext?.loadingTracker ?? adminContext.loadingTracker
    )
  )
  let loadAbortController: AbortController | null = null

  const getOwnResource = ({ method = 'get', child }: ResourceOptions = {}) => {
    const { resource } = getSchema()
    const collection = getResource(resource, {
      type: 'collection',
      method,
      parent: (
        parentResourceContext?.getResource({ method, child: resource }) ?? null
      ),
      child
    })
    return getMemberResource(getItemId(), collection) || collection
  }

  const providesData = computed(() => !!getOwnResource())
  const isTransient = computed(() => getIsTransient(providesData.value))
  const isLoading = computed(() => loadingTracker.isLoading)

  // Continue the verbs of the parent, with the transient ones in nested data:
  const verbs = computed(() => {
    const parentVerbs = parentRouteContext?.verbs ?? defaultVerbs
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
    adminContext.notify({ type: 'error', error, title, text })
  }

  // Abort only the pending data load, as other requests, e.g. submits, change
  // data on the server and their outcome needs to be notified:
  const abortLoad = () => loadAbortController?.abort()
  onUnmounted(abortLoad)

  // Errors are notified unless `callback()` returns `true`. Aborted requests
  // settle without calling it: Each data load aborts the previous one, and
  // unmounting aborts the pending one.
  const request = async (
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
      abortLoad()
      loadAbortController = controller
    }
    const endLoading = loadingTracker.begin()
    let response = null
    let error: any = null
    try {
      response = await sendRequest(
        { adminContext, resourceContext: null },
        {
          method: resource?.method || method,
          resource: resource ?? undefined,
          query,
          data,
          signal: controller.signal
        }
      )
    } catch (err) {
      error = err
    } finally {
      if (loadAbortController === controller) {
        loadAbortController = null
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

  // Emit the event of the button, and call `notify()` unless its handlers
  // returned a value or notified themselves:
  const emitButtonEvent = async (
    button: SubmitButton,
    event: string,
    { notify, error }: ButtonEventOptions
  ) => {
    // The same context as the button's other events, with the error:
    const context = button.createContext({ error })
    const res = await button.emitEvent(event, { context })
    if (notify && res === undefined && !context.wasNotified) {
      notify(error)
    }
    return res
  }

  return {
    // Only forms and sources with a resource provide it to their components:
    resourceContext: hasResource(getSchema())
      ? markRaw({ getResource: getOwnResource })
      : null,
    loadingTracker,
    isLoading,
    providesData,
    isTransient,
    verbs,
    getResource: getOwnResource,
    request,
    abortLoad,
    emitButtonEvent,

    loadData({ query, onLoad, onError }: LoadOptions) {
      return request(
        { method: 'get', query, isDataLoad: true },
        async (err, response) => {
          if (err) {
            return !!response && !!onError?.(response)
          } else {
            // Await the handlers, so that their errors are notified below.
            await onLoad(response.data)
          }
        }
      ).catch(notifyRequestError)
    },

    // Only post, put and patch requests pass the data as payload:
    getPayloadData(button: SubmitButton, method: HttpMethod) {
      return (
        ['post', 'put', 'patch'].includes(method) && (
          button.getSchemaValue(['resource', 'data']) ||
          button.context.serializedItem
        )
      )
    },

    // Resolve to whether the request succeeded:
    async submitResource(
      button: SubmitButton,
      resource: ApiResource,
      method: HttpMethod,
      payload: any,
      {
        onSuccess,
        onError,
        notifySuccess = () =>
          adminContext.notify({
            type: 'success',
            title: 'Request Successful',
            text: 'Request was successfully sent.'
          }),
        notifyError = error => {
          const message = getErrorMessage(error)
          adminContext.notify({
            type: 'error',
            error,
            title: 'Request Error',
            text: message
              ? ['Unable to send request:', message]
              : 'Unable to send request.'
          })
        },
        showValidationErrors
      }: SubmitResourceOptions
    ) {
      let isSuccessful = false
      await request(
        { method, resource, data: payload },
        async (err, response) => {
          const responseData = response?.data
          if (err) {
            // Dito.js validation errors are shown on the fields:
            const errors = response?.status === 400 && responseData.errors
            if (errors) {
              await showValidationErrors(errors)
            } else {
              const error = isObject(responseData) ? responseData : err
              const isHandled = await onError?.(error)
              await emitButtonEvent(button, 'error', {
                notify: isHandled ? undefined : notifyError,
                error
              })
            }
            return true // The error was handled.
          } else {
            // Forms merge the id of created items in `onSuccess()`, before the
            // notification reads the item label:
            const isHandled = await onSuccess?.(responseData)
            await emitButtonEvent(button, 'success', {
              notify: isHandled ? undefined : notifySuccess
            })
            isSuccessful = true
          }
        }
      )
      return isSuccessful
    }
  }
}
