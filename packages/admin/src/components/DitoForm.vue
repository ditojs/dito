<template lang="pug">
.dito-form.dito-scroll-parent(
  :class="{ 'dito-form--embedded': isEmbeddedRoute }"
  :data-resource="schemaPath"
)
  //- Embedded form routes render in the view of their parent instead:
  DitoRouterView(
    v-if="!isLastUnnestedRoute && !isEmbeddedRoute"
    v-show="!isActiveRoute"
    :routeLevel="routeContext.level + 1"
  )
  //- NOTE: `v-show` keeps forms alive while nested forms edit their data.
  DitoFormInner(
    v-show="isActiveRoute"
    :nested="isEmbeddedRoute"
    :label="itemLabelText"
  )
    //- Prevent implicit submission: https://stackoverflow.com/a/51507806
    button(
      v-show="false"
      type="submit"
      disabled
    )
    DitoSchema(
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :store="store"
      :padding="isEmbeddedRoute ? 'nested' : 'root'"
      :active="isActiveRoute"
      :scrollable="!isEmbeddedRoute"
      generateLabels
    )
      template(#buttons)
        DitoButtons.dito-buttons--round.dito-buttons--large.dito-buttons--main(
          :class="{ 'dito-buttons--sticky': !isEmbeddedRoute }"
          :buttons="buttonSchemas"
          :dataPath="dataPath"
          :data="data"
          :store="store"
        )
</template>

<script>
import { computed, inject, reactive, ref, toRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  capitalize,
  assignDeeply,
  equals,
  escapeHtml,
  pickBy
} from '@ditojs/utils'
import {
  useRouteContainer,
  useRouteRecord
} from '../composables/useRouteContainer.ts'
import { useResource } from '../composables/useResource.ts'
import { useSourceItems } from '../composables/useSourceItems.ts'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useSchemaEvents } from '../composables/useSchemaEvents.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { waitUntilDataModelSettled } from '../utils/services.ts'
import { adminContextKey } from '../utils/keys.ts'
import { getResource } from '../utils/resource.js'
import { isListSource, isObjectSource } from '../utils/schema/structure.js'
import {
  getButtonSchemas,
  getItemFormSchema,
  hasSubmitButton
} from '../utils/schema/lookup.js'
import {
  getComponentPathByDataPath,
  initializeData,
  deserializeData
} from '../utils/schema/data.js'
import { appendDataPath, getParentDataPath } from '../utils/data.js'
import { getErrorMessage } from '../utils/request.js'
import { cloneWithUids } from '../utils/uid.js'
import {
  getChildSourceSchemas,
  getItemAdapter
} from '../utils/schema/types.ts'
import { mergeData } from '../utils/mergeData.ts'
import { createDraftRoot } from '../utils/draftRoot.ts'
import { transientNote } from '../utils/dialogs.js'
import { getTextFromHtml } from '../utils/html.js'

export default {
  setup() {
    const router = useRouter()
    const adminContext = inject(adminContextKey)
    const route = useRouteRecord()
    const { node, parent: parentRouteContext } = route
    const parentDataContext = parentRouteContext.dataContext

    // The source of the item, and what the route says about it:
    const sourceSchema = computed(() => node.value.source.schema)
    const itemAdapter = computed(() => getItemAdapter(sourceSchema.value))
    // vue-router can't map several parameters of the same name to several
    // components, see https://github.com/vuejs/vue-router/issues/1345
    const param = computed(
      () => router.currentRoute.value.params[node.value.param] ?? null
    )
    const isCreating = computed(() => param.value === 'create')
    const isMutating = computed(() => !!sourceSchema.value.mutate)
    const creationType = computed(() => router.currentRoute.value.query.type)
    const itemId = computed(() => (isCreating.value ? null : param.value))
    const isEmbeddedRoute = computed(() => node.value.isEmbeddedForm)

    // Forms without a resource of their own edit an item of their parent:
    const requests = useResource({
      adminContext,
      parentResourceContext: parentRouteContext.resourceContext,
      parentRouteContext,
      getSchema: () => sourceSchema.value,
      getItemId: () => itemId.value,
      isTransient: providesData => !providesData
    })
    const { isTransient, providesData } = requests
    // Mutating forms edit the item in place, the others a draft of it:
    const isEditingParentItem = computed(
      () => isTransient.value && isMutating.value && !isCreating.value
    )
    const hasDraft = computed(
      () => isTransient.value && !isMutating.value && !isCreating.value
    )

    const verbs = computed(() => {
      const verbs = requests.verbs.value
      return {
        ...verbs,
        submit: isCreating.value ? verbs.create : verbs.save,
        submitted: isCreating.value ? verbs.created : verbs.saved,
        cancel: providesData.value ? verbs.cancel : verbs.close,
        cancelled: providesData.value ? verbs.cancelled : verbs.closed
      }
    })

    // The item of the form in the data of its parent route:
    const sourceLocation = computed(() => {
      const { node: parentNode, state } = parentRouteContext
      return state.data
        ? parentNode.findItem(node.value, {
            ...state,
            routeParams: route.params.value
          })
        : null
    })
    const sourceData = computed(() => sourceLocation.value?.data ?? null)
    const sourceKey = computed(() => sourceLocation.value?.key ?? null)
    const sourceItem = computed(() =>
      sourceData.value && sourceKey.value !== null
        ? sourceData.value[sourceKey.value]
        : undefined
    )
    // Forms that load their own data start a new data path:
    const dataPath = computed(() =>
      isTransient.value
        ? appendDataPath(
            parentDataContext.dataPath,
            sourceLocation.value?.dataPath ?? ''
          )
        : ''
    )
    // Forms of items in the data of their parent continue the component path
    // of their source, e.g. `main/chapters/1`:
    const { componentPath } = useComponentPath(
      () => dataPath.value,
      () =>
        isTransient.value
          ? getComponentPathByDataPath(
              parentDataContext.schema,
              parentDataContext.data,
              dataPath.value,
              {
                dataPath: parentDataContext.dataPath,
                componentPath: parentDataContext.componentPath,
                services: parentDataContext.services,
                rootData: parentDataContext.model.rootData
              }
            )
          : ''
    )

    const {
      routeContext,
      dataContext,
      model,
      services,
      store,
      schemaPath,
      navigateWithin
    } = useRouteContainer({
      route,
      schema: () => schema.value,
      sourceSchema: () => sourceSchema.value,
      dataPath: () => dataPath.value,
      // Forms of items in the data of their parent read the parent's root
      // data, with their draft in place of the item, and read-only elsewhere:
      rootData: data => {
        const rootData = parentDataContext.model.rootData
        return isTransient.value
          ? !isMutating.value && sourceData.value
            ? createDraftRoot(rootData, dataPath.value, data)
            : rootData
          : data
      },
      componentPath: () => componentPath.value,
      isCreating: () => isCreating.value,
      isTransient: () => isTransient.value,
      isMutating: () => isMutating.value,
      parentModel: () => parentDataContext.model,
      isEditingParentItem: () => isEditingParentItem.value,
      getParentItem: () => sourceItem.value,
      itemLabel: () => itemLabel.value,
      canSave: () => hasSubmitButton(buttonSchemas.value),
      resetItem: data => resetItem(data),
      copyErrors: () => copyErrors(),
      breadcrumb: () => (
        schema.value.breadcrumb ||
        `${
          capitalize(isCreating.value ? verbs.value.create : verbs.value.edit)
        } ${getLabel(schema.value)}`
      ),
      verbs: () => verbs.value,
      resourceContext: requests.resourceContext,
      // The components of the form don't see the source of its parent, e.g.
      // of a tree that renders the forms of its items:
      sourceContext: null,
      submit: (button, options) => submit(button, options)
    })

    // The data, and the schema that the type of the item or of the item to
    // create determines:
    const data = computed(() => dataContext.data)
    const schema = computed(() =>
      getItemFormSchema(
        sourceSchema.value,
        data.value ||
        (creationType.value ? { type: creationType.value } : null),
        context
      )
    )
    const { context, createContext } = useSchemaContext(
      reactive({ schema, data, dataPath }),
      { services }
    )
    const { getLabel } = useSchemaValue(context)
    // The events of the data, e.g. `load`, like the form's schema emits them:
    const createEventContext = values =>
      createContext({
        get formLabel() {
          return getLabel(schema.value)
        },
        ...values
      })
    const { emitEvent: emitSchemaEvent } = useSchemaEvents(() => schema.value, {
      services,
      createContext: createEventContext
    })
    const { getItemId, getItemLabel } = useSourceItems({
      services,
      getContext: () => context,
      getSchema: () => sourceSchema.value,
      getDataPath: () => dataPath.value,
      isTransient: () => isTransient.value
    })
    const itemLabel = computed(() =>
      getItemLabel(sourceSchema.value, data.value, { extended: true })
    )

    const close = () => routeContext.close()

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

            submit: !isMutating.value && {
              type: 'submit',
              // Submit buttons close the form by default:
              closeForm: true,
              onClick: ({ submit }) => submit()
            }
          },
          schema.value.buttons
        )
      )
    )

    // Merge save responses into the item, to keep the identity of its objects.
    // In the data of their parent, the responses are edits still to apply:
    const mergeResponse = value => {
      if (isTransient.value) {
        deserializeData(schema.value, value, {
          services,
          dataPath: dataPath.value,
          rootData: dataContext.model.rootData
        })
        if (!equals(data.value, value)) {
          mergeData(schema.value, data.value, value, {
            services,
            shouldKeepSourcesWithResource: true
          })
          dataContext.markEdited()
        }
      } else {
        model.mergeFromServer(value)
      }
    }

    // Reset the item like loaded data, merged to keep the identity of its
    // objects. The item keeps its id, type and position, which determine its
    // resource, form and place in the list, unless the data sets them. Forms
    // that edit their parent's item in place reset it there, without an edit:
    const resetItem = value => {
      const { idKey = 'id', orderKey } = sourceSchema.value
      const keys = [idKey, 'type', orderKey]
      value = {
        ...pickBy(data.value ?? {}, (_, key) => keys.includes(key)),
        ...value
      }
      if (isEditingParentItem.value) {
        const parentModel = parentDataContext.model
        const options = {
          services,
          dataPath: dataPath.value,
          rootData: parentModel.rootData
        }
        deserializeData(schema.value, value, options)
        mergeData(schema.value, data.value, value, { services })
        // Like the data model, which writes the values of components with
        // `computeValue()` itself:
        initializeData(schema.value, data.value, services, {
          ...options,
          shouldSkipSourcesWithResource: true,
          shouldSetDefaultsOfComponentsWithCompute: false
        })
        parentModel.clearErrors(dataPath.value)
      } else {
        model.mergeFromServer(value, { isReset: true })
      }
      return data.value
    }

    // Copy the errors of the item in the parent's model into the draft:
    const copyErrors = () => {
      const draft = hasDraft.value ? model.data : null
      if (draft) {
        if (itemAdapter.value) {
          // The list holds the errors of its primitives:
          model.copyValueErrors(parentDataContext.model, dataPath.value, {
            data: draft,
            name: itemAdapter.value.name
          })
        } else {
          model.copyErrors(parentDataContext.model, draft)
        }
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
      const type = creationType.value
      model.replaceWithNewData(type ? { type } : {})
    }

    // Hold the item by its identity, in a draft unless the form edits it in
    // place. When the item moves, the form follows it to its new route. Forms
    // of list items close once their item is gone.
    const original = ref(null)
    const setupSourceItem = ([item, path], [, previousPath] = []) => {
      if (isTransient.value) {
        if (toRaw(item) !== toRaw(original.value)) {
          // Other items at the same path mean that the data changed:
          const hasDataChanged = !!original.value && path === previousPath
          const params = (
            hasDataChanged &&
            parentRouteContext.node.findItemParams(
              node.value,
              { ...parentRouteContext.state, routeParams: route.params.value },
              original.value
            )
          )
          if (params) {
            // Change the parameters first, to not leave the form on the way:
            const {
              name,
              query,
              hash,
              params: currentParams
            } = router.currentRoute.value
            route.params.value = { ...currentParams, ...params }
            router.replace({ name, params: route.params.value, query, hash })
          } else if (hasDataChanged && isListSource(sourceSchema.value)) {
            close()
          } else {
            original.value = item ?? null
            if (hasDraft.value) {
              // Items share their child sources with their source, e.g. tree
              // items their children with the tree, which edits them:
              const transferables = getChildSourceSchemas(
                sourceSchema.value
              ).map(({ name }) => item?.[name])
              // Primitives are edited wrapped by the item adapter of the list:
              model.replace(
                item == null
                  ? null
                  : itemAdapter.value
                    ? itemAdapter.value.wrap(item)
                    : cloneWithUids(item, { transferables })
              )
              copyErrors()
            }
          }
        }
        if (
          item === null &&
          !isCreating.value &&
          isObjectSource(sourceSchema.value)
        ) {
          // Objects without data redirect to their create route:
          router.push({ path: `${path}/create` })
        }
      }
    }

    // Merge a copy of the draft into the parent's data, which never shares
    // the draft's objects, or write back the unwrapped primitive:
    const submitTransient = async (button, options) => {
      const { onSuccess, onError, notifySuccess, notifyError } = options
      const parentModel = parentDataContext.model
      const list = sourceData.value
      const adapter = itemAdapter.value
      const item = adapter
        ? adapter.unwrap(data.value)
        : cloneWithUids(data.value)
      const success = !!list
      if (success) {
        if (isCreating.value && !isObjectSource(sourceSchema.value)) {
          // The data path of new items ends with `create` in their list:
          parentModel.insert(
            {
              schema: sourceSchema.value,
              list,
              dataPath: getParentDataPath(dataPath.value)
            },
            list.length,
            item
          )
        } else {
          const location = {
            data: list,
            name: sourceKey.value,
            dataPath: dataPath.value
          }
          if (isCreating.value || adapter) {
            parentModel.set(location, item)
            // Primitives have no identity, so keep the draft of the new value:
            if (adapter) {
              original.value = item
            }
          } else {
            parentModel.merge(location, item, sourceSchema.value)
          }
          emitSchemaEvent('change')
        }
        // `apply` handlers can't suppress the notification, unlike `success`:
        await onSuccess()
        await requests.emitButtonEvent(button, 'success', {
          notify: notifySuccess
        })
      } else {
        const error = 'Could not submit transient item'
        const isHandled = await onError(error)
        await requests.emitButtonEvent(button, 'error', {
          notify: isHandled ? undefined : notifyError,
          error
        })
      }
      return success
    }

    const getSubmitVerb = (present = true) =>
      isCreating.value
        ? present
          ? 'create'
          : 'created'
        : present
          ? 'submit'
          : 'submitted'

    const submitData = async (button, {
      validate = true,
      closeForm = false
    } = {}) => {
      // The form may open another item or be left while the submit is pending:
      const submittedPath = routeContext.path
      const submittedData = data.value
      // Wait for computed values that depend on pending loads:
      await waitUntilDataModelSettled(services)
      if (validate && !dataContext.validate()) {
        return false
      }
      // Allow buttons to override both method and resource path to submit to:
      let method = isCreating.value ? 'post' : 'patch'
      let resource = requests.getResource({ method })
      const buttonResource = getResource(button.schema.resource, {
        parent: resource
      })
      resource = buttonResource || resource
      method = resource?.method || method

      const getVerb = present => verbs.value[getSubmitVerb(present)]
      // NOTE: `itemLabel` is HTML, the other values need to be escaped:
      const notifySubmitError = (error, message = null) => {
        const verb = getVerb(true)
        adminContext.notify({
          type: 'error',
          error,
          title: 'Request Error',
          html: message
            ? [`Unable to ${verb} ${itemLabel.value}:`, escapeHtml(message)]
            : `Unable to ${verb} ${itemLabel.value}.`
        })
      }
      // Resolve to whether the handlers of the event returned a value or
      // notified themselves, which suppresses dito's notification:
      const emitResultEvent = async (event, values) => {
        const context = createEventContext(values)
        const result = await emitSchemaEvent(event, { context })
        return result !== undefined || context.wasNotified
      }
      // Clean up only the data that was submitted, as the form may show other
      // data once the submit succeeds:
      const isSubmittedData = () => data.value === submittedData
      const isTransientSubmit = !buttonResource && isTransient.value
      const callbacks = {
        onSuccess: async () => {
          if (isSubmittedData()) {
            dataContext.model.clearErrors(dataPath.value)
            // The responses of buttons with resources in drafts stay dirty:
            if (!isTransient.value || !buttonResource) {
              model.markClean({ dataPath: '' })
            }
            // Nested forms apply their draft to the parent instead of saving:
            return emitResultEvent(isTransientSubmit ? 'apply' : 'success')
          }
          return false
        },
        onError: error => emitResultEvent('error', { error })
      }

      let success
      if (isTransientSubmit) {
        success = await submitTransient(button, {
          ...callbacks,
          notifySuccess: () => {
            const verb = getVerb(false)
            adminContext.notify({
              type: 'info',
              title: isCreating.value
                ? `Item ${capitalize(verb)}`
                : `Change ${capitalize(verb)}`,
              html: [
                isCreating.value
                  ? `${itemLabel.value} was ${verb}.`
                  : `Changes to ${itemLabel.value} were ${verb}.`,
                transientNote
              ]
            })
          },
          notifyError: error => notifySubmitError(error)
        })
      } else {
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
                html: `${itemLabel.value} was ${verb}.`
              })
            },
            // Errors without a message are notified without details:
            notifyError: error =>
              notifySubmitError(error, getErrorMessage(error)),
            showValidationErrors: errors =>
              dataContext.showValidationErrors(errors)
          }
        )
        if (success) {
          // The source that lists the item loads it again:
          const source = [...parentDataContext.sources].find(
            source => source.node === node.value.source
          )
          source?.reload()
        }
      }
      if (success) {
        if (closeForm || button.closeForm) {
          navigateWithin(submittedPath, close)
        } else if (isCreating.value) {
          // Redirect to the form editing the newly created item. Items in the
          // data of the parent are addressed by their index, objects by the
          // form without parameter:
          const id = !isTransientSubmit
            ? getItemId(sourceSchema.value, submittedData)
            : isObjectSource(sourceSchema.value)
              ? null
              : sourceData.value.length - 1
          navigateWithin(submittedPath, () => {
            const { params, hash } = router.currentRoute.value
            router.replace({
              name: route.record.value.name,
              params: { ...params, [node.value.param]: id },
              hash // Keep the tab.
            })
          })
        }
      }
      return success
    }

    // Leaving the route waits for pending submits:
    const submit = (button, options) =>
      dataContext.model.trackPendingSubmit(submitData(button, options))

    if (isCreating.value) {
      createData()
    } else if (providesData.value) {
      loadData()
    }

    watch(isCreating, isCreating => {
      if (isCreating) {
        createData()
      }
    })

    // The path tells changes of the data from changes of the route:
    watch(() => [sourceItem.value, routeContext.path], setupSourceItem, {
      immediate: true
    })

    watch(
      router.currentRoute,
      (to, from) => {
        // Load the data of other items that the form navigates to:
        const { param } = node.value
        const toParam = to.params[param]
        const fromParam = from.params[param]
        // Created items are merged into the form, which opens them as they are:
        const isOpeningCreatedItem = (
          fromParam === 'create' &&
          getItemId(sourceSchema.value, data.value) === toParam
        )
        if (
          param &&
          providesData.value &&
          toParam !== 'create' &&
          toParam !== fromParam &&
          !isOpeningCreatedItem
        ) {
          loadData()
        }
      },
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      { flush: 'post' }
    )

    // Whether the route is the last one that needs its own router-view:
    const isLastUnnestedRoute = computed(() => {
      const record = router.currentRoute.value.matched.findLast(
        record => !record.meta.node?.isEmbeddedForm
      )
      return route.record.value === record
    })

    return {
      routeContext,
      dataContext,
      schema,
      data,
      dataPath,
      store,
      schemaPath,
      buttonSchemas,
      isEmbeddedRoute,
      isLastUnnestedRoute,
      isActiveRoute: computed(
        () => routeContext.isLastRoute || isLastUnnestedRoute.value
      ),
      itemLabelText: computed(() => getTextFromHtml(itemLabel.value))
    }
  }
}
</script>
