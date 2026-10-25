import {
  computed,
  inject,
  onUnmounted,
  provide,
  reactive,
  toValue,
  watch
} from 'vue'
import { setupForm, checkFormProperties } from '../utils/schema/setup.js'
import { getItemId } from '../utils/schema/data.js'
import { hasSubmitButton } from '../utils/schema/lookup.js'
import { hasRoutedForms, ViewNode } from '../utils/RouteTree.ts'
import { isPage } from '../utils/schema/structure.js'
import {
  adminContextKey,
  componentPathKey,
  dataContextKey,
  resourceContextKey,
  routeContextKey,
  schemaFormKey
} from '../utils/keys.ts'
import { useContainer } from './useContainer.ts'
import { useResource } from './useResource.ts'
import { useForm } from './useForm.ts'
import type { SubmitButton, SubmitOptions } from '../utils/ResourceContext.ts'
import type { Schema } from '../utils/types.ts'
import type { useDitoForm as publicUseDitoForm } from '../../types/index.d.ts'

// Set up a form in the calling component, which loads, edits and submits the
// item of its resource, for `DitoSchemaForm` to render.
export function useDitoForm({
  resource,
  id = null,
  buttons,
  ...formSchema
}: Parameters<typeof publicUseDitoForm>[0]) {
  checkFormProperties(formSchema)
  const adminContext = inject(adminContextKey)!
  const routeContext = inject(routeContextKey, null)
  const isInDialog = !!inject(dataContextKey, null)?.closeDialog
  const parent = inject(componentPathKey, null)
  // Like the forms of `fields()` callbacks, the form renders while it's set
  // up. Outside of dialogs, there is nothing to cancel:
  const schema = reactive({
    type: 'form',
    ...formSchema,
    buttons: isInDialog ? buttons : { cancel: false, ...buttons }
  }) as Schema
  // In pages, the sources of the form route their forms under the page, as
  // the page's route claims the paths below it:
  const node = routeContext?.node
  const isInPage = node instanceof ViewNode && isPage(node.schema)
  // Forms that fail to set up are logged, and load no item:
  const formSetup = setupForm(adminContext.api, schema)
    .then(() => {
      if (!isInPage && hasRoutedForms(schema)) {
        throw new Error(
          'Forms of `useDitoForm()` only support components that produce ' +
          'routes in pages'
        )
      }
      return true
    })
    .catch(error => {
      console.error(error)
      return false
    })
  const sourceSchema = { resource, form: schema } as Schema

  // Created items are saved with the id that their response merged. Read it
  // from the item, as the form's resource depends on it:
  const getDataId = () => (
    (dataContext.data && getItemId(sourceSchema, dataContext.data)) ?? null
  )
  const itemId = computed(() => {
    const value = toValue(id)
    return value != null ? String(value) : getDataId()
  })

  const requests = useResource({
    adminContext,
    parentResourceContext: inject(resourceContextKey, null),
    parentRouteContext: routeContext,
    getSchema: () => sourceSchema,
    getItemId: () => itemId.value,
    isTransient: () => false
  })

  const { dataContext, model, store } = useContainer({
    schema: () => schema,
    sourceSchema: () => sourceSchema,
    // The form continues the path of the component that sets it up:
    componentPath: () => parent?.node.componentPath ?? '',
    isCreating: () => itemId.value === null,
    canSave: () => hasSubmitButton(form.buttonSchemas.value),
    // Buttons submit the form, not a source around it:
    sourceContext: null,
    resourceContext: requests.resourceContext,
    verbs: () => form.verbs.value,
    submit: (button, options) => submit(button, options)
  })

  const form = useForm({
    requests,
    dataContext,
    model,
    sourceSchema: () => sourceSchema,
    creationType: () => null,
    close: async () => {
      dataContext.closeDialog?.()
      return isInDialog
    },
    submitTransient: async () => false
  })

  const submit = (button: SubmitButton | null, options: SubmitOptions = {}) =>
    model.trackPendingSubmit(
      (async () => {
        const { success } = await form.submitData(
          button ?? form.getSubmitButton(),
          options
        )
        if (success && (options.closeForm || button?.closeForm)) {
          dataContext.closeDialog?.(dataContext.data)
        }
        return success
      })()
    )

  // Load the item of each id, but not the one that was just created. Wait for
  // the setup, which applies the defaults that new items are created with:
  watch(
    () => toValue(id),
    async id => {
      if (await formSetup) {
        if (id == null) {
          form.createData()
        } else if (String(id) !== getDataId()) {
          form.loadData()
        }
      }
    },
    { immediate: true }
  )

  // In routes, the form's changes and item are the route's, e.g. for the leave
  // guard, the trail and the warning before unloading the page:
  if (routeContext) {
    if (routeContext.componentForm) {
      throw new Error(
        'Unable to set up the form: Its route has a form of `useDitoForm()` ' +
        'already.'
      )
    }
    const componentForm = {
      dataContext,
      get itemLabel() {
        return form.itemLabelText.value
      }
    }
    routeContext.componentForm = componentForm
    onUnmounted(() => {
      if (routeContext.componentForm === componentForm) {
        routeContext.componentForm = null
      }
    })
  }

  provide(schemaFormKey, {
    dataContext,
    store,
    buttonSchemas: form.buttonSchemas,
    isPageForm: isInPage && !isInDialog
  })
  return form.context
}
