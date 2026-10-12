import { isObject } from '@ditojs/utils'
import { getErrorMessage } from '../utils/request.js'
import type { AdminContext } from '../utils/AdminContext.ts'
import type { SubmitButton } from '../utils/ResourceContext.ts'
import type { Data, Resource } from '../utils/types.ts'
import type { HTTPMethod } from '../../types/index.d.ts'
import type { ResourceRequests } from './useResource.ts'

export interface SubmitResourceOptions {
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  notifySuccess?: () => void
  notifyError?: (error: any) => void
}

// Submit the data of a form or source to resources through its buttons, and
// emit the buttons' `success` and `error` events.
export function useResourceSubmit({
  admin,
  handleRequest,
  getData,
  getItemLabel = () => null,
  showValidationErrors
}: Pick<ResourceRequests, 'handleRequest'> & {
  admin: AdminContext
  getData: () => Data | null
  getItemLabel?: () => string | null
  showValidationErrors(errors: Record<string, any>): Promise<unknown>
}) {
  // Emit the event of the button, and notify with `notify()` unless its
  // handlers returned a value or notified themselves:
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
    emitButtonEvent,

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
          // Errors without a message are notified without details:
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
            // Call `onSuccess()` before notifying, which reads the item label,
            // so that forms can merge the id of created items first:
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
