import { computed } from 'vue'
import { assignDeeply, capitalize, equals, html } from '@ditojs/utils'
import { getResource } from '../utils/resource.js'
import { getErrorMessage } from '../utils/request.js'
import { getButtonSchemas } from '../utils/schema/lookup.js'
import { deserializeData } from '../utils/schema/data.js'
import { mergeData } from '../utils/mergeData.ts'
import { transientNote } from '../utils/dialogs.js'
import { getText } from '../utils/html.js'
import { waitUntilDataModelSettled } from '../utils/services.ts'
import { useSchemaContext } from './useSchemaContext.ts'
import { useSchemaValue } from './useSchemaValue.ts'
import { useSchemaEvents } from './useSchemaEvents.ts'
import { useSourceItems } from './useSourceItems.ts'
import type { useResource } from './useResource.ts'
import type { DataContext } from '../utils/DataContext.ts'
import type { DataModel } from '../utils/DataModel.ts'
import type { SubmitButton, SubmitOptions } from '../utils/ResourceContext.ts'
import type { Context } from '../utils/schema/types.ts'
import type { Schema } from '../utils/types.ts'
import type { HttpMethod } from '../../types/index.d.ts'

interface TransientSubmitOptions {
  // Resolve to `true` to suppress the notification:
  onSuccess(): Promise<boolean>
  onError(error: any): Promise<boolean>
  notifySuccess(): void
  notifyError(error: any): void
}

interface FormOptions {
  // The requests of the form, of its own resource or the parent's:
  requests: ReturnType<typeof useResource>
  // The container of the form: its data context and its own model:
  dataContext: DataContext
  model: DataModel
  sourceSchema: () => Schema
  creationType: () => string | null
  close: () => Promise<boolean>
  // Apply the draft of items in the data of the parent:
  submitTransient(
    button: SubmitButton,
    options: TransientSubmitOptions
  ): Promise<boolean>
}

// Load, create and submit the item of a form through its container, with the
// verbs, buttons, label and events of the form, and its notifications.
export function useForm({
  requests,
  dataContext,
  model,
  sourceSchema,
  creationType,
  close,
  submitTransient
}: FormOptions) {
  const { services } = dataContext
  const { adminContext } = services
  const { isTransient, providesData } = requests

  const verbs = computed((): Record<string, string> => {
    const verbs: Record<string, string> = requests.verbs.value
    return {
      ...verbs,
      submit: dataContext.isCreating ? verbs.create : verbs.save,
      submitted: dataContext.isCreating ? verbs.created : verbs.saved,
      cancel: providesData.value ? verbs.cancel : verbs.close,
      cancelled: providesData.value ? verbs.cancelled : verbs.closed
    }
  })

  const { context, createContext } = useSchemaContext(dataContext, {
    services
  })
  const { getLabelText, getSchemaValue } = useSchemaValue(context)
  // The events of the data, e.g. `load`, like the form's schema emits them:
  const createEventContext = (values?: Context) =>
    createContext({
      get formLabel() {
        return getLabelText(dataContext.schema)
      },
      ...values
    })
  const { emitEvent: emitSchemaEvent } = useSchemaEvents(
    () => dataContext.schema,
    { services, createContext: createEventContext }
  )
  const { getItemId, getItemLabel } = useSourceItems({
    services,
    getContext: () => context,
    getSchema: sourceSchema,
    getDataPath: () => dataContext.dataPath,
    isTransient: () => isTransient.value
  })
  // `html` for notifications, text for the contexts and the form's label:
  const itemLabel = computed(() =>
    getItemLabel(sourceSchema(), dataContext.data, { extended: true })
  )
  const itemLabelText = computed(() => getText(itemLabel.value))

  // Fire `cancel` only once the form closed:
  const cancel = async () => {
    if (await close()) {
      emitSchemaEvent('cancel')
    }
  }

  const buttonSchemas = computed(() =>
    getButtonSchemas(
      assignDeeply(
        {
          cancel: {
            type: 'button',
            onClick: () => cancel()
          },

          submit: !sourceSchema().mutate && {
            type: 'submit',
            // Submit buttons close the form by default:
            closeForm: true,
            onClick: ({ submit }: Context) => submit()
          }
        },
        dataContext.schema.buttons
      )
    )
  )

  // Outside of buttons, `context.submit()` submits with the form's submit
  // button, with the values and events of its schema, but leaves the form open
  // unless `closeForm` is passed:
  const { emitEvent: emitSubmitEvent } = useSchemaEvents(
    () => buttonSchemas.value.submit,
    { services, createContext: createEventContext }
  )
  const getSubmitButton = (): SubmitButton => {
    const schema = buttonSchemas.value.submit
    if (schema) {
      return {
        schema,
        context,
        closeForm: false,
        createContext: createEventContext,
        getSchemaValue: (keyOrDataPath, options = {}) =>
          getSchemaValue(keyOrDataPath, { schema, ...options }),
        emitEvent: emitSubmitEvent
      }
    } else {
      throw new Error('Unable to submit: The form has no submit button.')
    }
  }

  // Merge save responses into the item, to keep the identity of its objects.
  // In the data of their parent, the responses are edits still to apply:
  const mergeResponse = (value: any) => {
    const { schema, data } = dataContext
    if (isTransient.value) {
      deserializeData(schema, value, {
        services,
        dataPath: dataContext.dataPath,
        rootData: dataContext.model.rootData
      })
      if (!equals(data, value)) {
        mergeData(schema, data!, value, {
          services,
          shouldKeepSourcesWithResource: true
        })
        dataContext.markEdited()
      }
    } else {
      model.mergeFromServer(value)
    }
  }

  // Forms load their item without data, e.g. when they open another one:
  const loadData = () => {
    model.replace(null)
    return requests.loadData({
      onLoad: async data => {
        model.replaceFromServer(data)
        await emitSchemaEvent('load')
      }
    })
  }

  // Drop the item that the form loaded before, and its pending load:
  const createData = () => {
    requests.abortLoad()
    const type = creationType()
    model.replaceWithNewData(type ? { type } : {})
  }

  const getSubmitVerb = (present = true) =>
    dataContext.isCreating
      ? present
        ? 'create'
        : 'created'
      : present
        ? 'submit'
        : 'submitted'

  // Validate, resolve the resource, submit and notify, without navigating.
  // Resolve to whether it succeeded, and whether it applied a draft:
  const submitData = async (
    button: SubmitButton,
    { validate = true }: SubmitOptions = {}
  ) => {
    // The form may open another item while the submit is pending:
    const submittedData = dataContext.data
    // Wait for computed values that depend on pending loads:
    await waitUntilDataModelSettled(services)
    if (validate && !dataContext.validate()) {
      return { success: false }
    }
    // Allow buttons to override both method and resource path to submit to:
    let method: HttpMethod = dataContext.isCreating ? 'post' : 'patch'
    let resource = requests.getResource({ method })
    const buttonResource = getResource(button.schema.resource, {
      parent: resource
    })
    resource = buttonResource || resource
    method = resource?.method || method

    const getVerb = (present: boolean) => verbs.value[getSubmitVerb(present)]
    const notifySubmitError = (error: any, message: string | null = null) => {
      const verb = getVerb(true)
      adminContext.notify({
        type: 'error',
        error,
        title: 'Request Error',
        text: message
          ? [html`Unable to ${verb} ${itemLabel.value}:`, html`${message}`]
          : html`Unable to ${verb} ${itemLabel.value}.`
      })
    }
    // Resolve to whether the handlers of the event returned a value or
    // notified themselves, which suppresses dito's notification:
    const emitResultEvent = async (event: string, values?: Context) => {
      const context = createEventContext(values)
      const result = await emitSchemaEvent(event, { context })
      return result !== undefined || context.wasNotified
    }
    // Clean up only the data that was submitted, as the form may show other
    // data once the submit succeeds:
    const isSubmittedData = () => dataContext.data === submittedData
    const isTransientSubmit = !buttonResource && isTransient.value
    const callbacks = {
      onSuccess: async () => {
        if (isSubmittedData()) {
          dataContext.model.clearErrors(dataContext.dataPath)
          // The responses of buttons with resources in drafts stay dirty:
          if (!isTransient.value || !buttonResource) {
            model.markClean({ dataPath: '' })
          }
          // Nested forms apply their draft to the parent instead of saving:
          return emitResultEvent(isTransientSubmit ? 'apply' : 'success')
        }
        return false
      },
      onError: (error: any) => emitResultEvent('error', { error })
    }

    let success
    if (isTransientSubmit) {
      success = await submitTransient(button, {
        ...callbacks,
        notifySuccess: () => {
          const verb = getVerb(false)
          adminContext.notify({
            type: 'info',
            title: dataContext.isCreating
              ? `Item ${capitalize(verb)}`
              : `Change ${capitalize(verb)}`,
            text: [
              dataContext.isCreating
                ? html`${itemLabel.value} was ${verb}.`
                : html`Changes to ${itemLabel.value} were ${verb}.`,
              transientNote
            ]
          })
        },
        notifyError: error => notifySubmitError(error)
      })
    } else if (resource) {
      const payload = requests.getPayloadData(button, method)
      success = await requests.submitResource(
        button,
        resource,
        method,
        payload,
        {
          onSuccess: response => {
            if (response && isSubmittedData()) {
              mergeResponse(response)
            }
            return callbacks.onSuccess()
          },
          onError: callbacks.onError,
          notifySuccess: () => {
            const verb = getVerb(false)
            adminContext.notify({
              type: 'success',
              title: `Successfully ${capitalize(verb)}`,
              text: html`${itemLabel.value} was ${verb}.`
            })
          },
          // Errors without a message are notified without details:
          notifyError: error =>
            notifySubmitError(error, getErrorMessage(error)),
          showValidationErrors: errors =>
            dataContext.showValidationErrors(errors)
        }
      )
    } else {
      // Forms without a resource keep their data, without a notification:
      success = true
      await callbacks.onSuccess()
      await requests.emitButtonEvent(button, 'success', {})
    }
    return { success, isTransientSubmit }
  }

  return {
    context,
    getLabelText,
    emitSchemaEvent,
    getItemId,
    verbs,
    buttonSchemas,
    getSubmitButton,
    itemLabelText,
    loadData,
    createData,
    submitData
  }
}
