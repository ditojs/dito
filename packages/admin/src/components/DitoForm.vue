<template lang="pug">
.dito-form.dito-scroll-parent(
  :class="{ 'dito-form-nested': isNestedRoute }"
  :data-resource="schemaPath"
)
  //- Nested form routes render in the view of their parent instead:
  DitoRouterView(
    v-if="!isLastUnnestedRoute && !isNestedRoute"
    v-show="!isActiveRoute"
    :routeLevel="route.level + 1"
  )
  //- NOTE: `v-show` keeps forms alive while nested forms edit their data.
  DitoFormInner(
    v-show="isActiveRoute"
    :nested="isNestedRoute"
    :label="itemLabelText"
  )
    //- Prevent implicit submission: https://stackoverflow.com/a/51507806
    button(
      v-show="false"
      type="submit"
      disabled
    )
    DitoSchema(
      ref="schema"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :store="store"
      :padding="isNestedRoute ? 'nested' : 'root'"
      :active="isActiveRoute"
      :disabled="isLoading"
      :scrollable="!isNestedRoute"
      generateLabels
      @update:selected-tab="tab => (selectedTab = tab)"
    )
      template(#buttons)
        DitoButtons.dito-buttons--round.dito-buttons--large.dito-buttons--main(
          :class="{ 'dito-buttons--sticky': !isNestedRoute }"
          :buttons="buttonSchemas"
          :dataPath="dataPath"
          :data="data"
          :store="store"
          :disabled="isLoading"
        )
</template>

<script>
import {
  computed,
  inject,
  markRaw,
  provide,
  reactive,
  ref,
  shallowRef,
  toRaw,
  useTemplateRef,
  watch
} from 'vue'
import { useRouter } from 'vue-router'
import {
  capitalize,
  assignDeeply,
  equals,
  escapeHtml
} from '@ditojs/utils'
import { useRouteContainer } from '../composables/useRouteContainer.ts'
import { useResource } from '../composables/useResource.ts'
import { useItemLabel } from '../composables/useItemLabel.ts'
import {
  useContainer,
  useSchemaContext
} from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { waitUntilDataModelSettled } from '../utils/services.ts'
import { getResource } from '../utils/resource.js'
import { ResourceContext } from '../utils/ResourceContext.ts'
import { isListSource, isObjectSource } from '../utils/schema/structure.js'
import {
  getButtonSchemas,
  hasSubmitButton
} from '../utils/schema/lookup.js'
import {
  getComponentPathByDataPath,
  initializeData
} from '../utils/schema/data.js'
import { appendDataPath, getParentDataPath } from '../utils/data.js'
import { resolvePath } from '../utils/path.js'
import { getErrorMessage } from '../utils/request.js'
import { cloneWithUids } from '../utils/uid.js'
import { getChildSourceSchemas } from '../utils/schema/types.ts'
import { mergeData } from '../utils/mergeData.ts'
import { createDraftRoot } from '../utils/draftRoot.ts'
import { transientNote } from '../utils/dialogs.js'
import { getTextFromHtml } from '../utils/html.js'

export default {
  name: 'DitoForm',

  setup() {
    const router = useRouter()
    const admin = inject('admin')
    const parentRoute = inject('route')
    const schemaComponent = useTemplateRef('schema')
    const loadedData = ref(null)
    const createdData = ref(null)
    // The item of the parent that the form edits, and its draft:
    const original = ref(null)
    const draft = ref(null)
    const selectedTab = shallowRef(null)

    const sourceSchema = computed(() => ownRoute.node.source.schema)

    // vue-router can't map several parameters of the same name to several
    // components, see https://github.com/vuejs/vue-router/issues/1345
    const param = computed(
      () => router.currentRoute.value.params[ownRoute.node.param] ?? null
    )
    const isCreating = computed(() => param.value === 'create')
    const isMutating = computed(() => !!sourceSchema.value.mutate)
    const creationType = computed(() => router.currentRoute.value.query.type)
    const itemId = computed(() => (isCreating.value ? null : param.value))
    const isNestedRoute = computed(() => ownRoute.node.isNestedForm)

    // The item of the form in the data of its parent route:
    const sourceLocation = computed(() => {
      const { node, state } = parentRoute
      return state.data
        ? node.findItem(ownRoute.node, {
            ...state,
            routeParams: routeParams.value
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
    // Mutating forms edit the item of their parent, the others a draft of it:
    const inheritedData = computed(() =>
      isTransient.value
        ? isMutating.value
          ? sourceItem.value
          : draft.value
        : undefined
    )
    // A new item, the item that the form loaded, or the one of its parent:
    const data = computed(
      () => createdData.value || loadedData.value || inheritedData.value || null
    )
    const hasData = computed(() => !!data.value)
    // Mutating forms that create or load their item don't edit their parent's:
    const isEditingSourceItem = computed(
      () => isMutating.value && data.value === inheritedData.value
    )
    // Forms that load their own data start a new data path:
    const dataPath = computed(() =>
      isTransient.value
        ? appendDataPath(
            parentRoute.dataPath,
            sourceLocation.value?.dataPath ?? ''
          )
        : ''
    )
    // Forms of items in the data of their parent read the parent's root data,
    // with their draft in place of the item, and read-only elsewhere:
    const rootData = computed(() =>
      isTransient.value
        ? isMutating.value || !sourceData.value
          ? parentRoute.rootData
          : createDraftRoot(parentRoute.rootData, dataPath.value, data.value)
        : data.value
    )
    // Forms of items in the data of their parent continue the component path
    // of their source, e.g. `main/chapters/1`:
    const { componentPath } = useComponentPath(
      () => dataPath.value,
      () =>
        isTransient.value
          ? getComponentPathByDataPath(
              parentRoute.schema,
              parentRoute.state.data,
              dataPath.value,
              {
                dataPath: parentRoute.dataPath,
                componentPath: parentRoute.componentPath,
                services,
                rootData: parentRoute.rootData
              }
            )
          : ''
    )

    const schema = computed(() =>
      getItemFormSchema(
        sourceSchema.value,
        data.value || (
          creationType.value
            ? // The type of the item to create determines its form too:
              { type: creationType.value }
            : null
        ),
        context
      )
    )

    const buttonSchemas = computed(() =>
      getButtonSchemas(
        assignDeeply(
          {
            cancel: {
              type: 'button',
              events: {
                click: () => close()
              }
            },

            submit: !isMutating.value && {
              type: 'submit',
              // Submit buttons close the form by default:
              closeForm: true,
              events: {
                click: ({ submit }) => submit()
              }
            }
          },
          schema.value.buttons
        )
      )
    )

    const verbs = computed(() => {
      const verbs = requests.verbs.value
      const { providesData } = requests
      return {
        ...verbs,
        submit: isCreating.value ? verbs.create : verbs.save,
        submitted: isCreating.value ? verbs.created : verbs.saved,
        cancel: providesData.value ? verbs.cancel : verbs.close,
        cancelled: providesData.value ? verbs.cancelled : verbs.closed
      }
    })

    // Forms that edit the item of their parent edit it through its model:
    const getDataModel = () =>
      isEditingSourceItem.value ? parentRoute.container.model : ownDataModel

    const setData = value => {
      if (isTransient.value) {
        // Merge the data into the item of the parent like an edit:
        if (!equals(data.value, value)) {
          mergeData(schema.value, data.value, value, {
            services,
            shouldKeepSourcesWithResource: true
          })
          getDataModel().markEdited()
        }
      } else {
        // Merge data from the server, to keep the identity of its objects:
        loadedData.value =
          data.value && value ? getDataModel().mergeFromServer(value) : value
        createdData.value = null
      }
      return data.value
    }

    // Copy the errors of the item in the parent's model into the draft:
    const copyErrors = () => {
      if (draft.value) {
        ownDataModel.copyErrors(parentRoute.container.model, draft.value)
      }
    }

    const routeContainer = useRouteContainer(
      reactive({
        sourceSchema,
        schema,
        data,
        dataPath,
        rootData,
        componentPath,
        hasData,
        isCreating,
        isMutating,
        verbs,
        selectedTab,
        breadcrumb: computed(
          () => (
            schema.value.breadcrumb ||
            `${
              capitalize(
                isCreating.value ? verbs.value.create : verbs.value.edit
              )
            } ${getLabel(schema.value)}`
          )
        ),
        // Forms that edit the item of their parent leave their changes there:
        isDirty: computed(
          () => !isEditingSourceItem.value && ownContainer.isDirty
        ),
        isTransient: computed(() => isTransient.value),
        loadingTracker: computed(() => requests.loadingTracker),
        schemaComponent,
        setData,
        copyErrors,

        get dataModel() {
          return getDataModel()
        },

        get ownResource() {
          return ownResource
        }
      })
    )
    const { ownContainer, ownRoute, path, routeParams, navigateWithin } =
      routeContainer
    // The components of the form don't see the source of its parent, e.g. of
    // a tree that renders the forms of its items:
    const { services, createDataModel } = useContainer({
      container: ownContainer,
      route: ownRoute,
      source: null,

      get resource() {
        return ownResource
      }
    })
    const { context } = useSchemaContext(reactive({ schema, data, dataPath }), {
      services
    })
    const { getLabel } = useSchemaValue(context)

    const requests = useResource({
      services,
      parentRoute,
      getSchema: () => sourceSchema.value,
      getItemId: () => itemId.value,
      isTransient: providesData => !providesData,
      hasData: () => hasData.value,
      clearData: () => setData(null),
      // Keep the edits made while the data loaded, also in forms that can't
      // save them. The `load` event still fires, as the data did load:
      setLoadedData(value) {
        if (!getDataModel().isEdited) {
          setData(value)
        }
      },
      emitLoad: () => emitSchemaEvent('load'),
      getData: () => data.value,
      getItemLabel: () => itemLabel.value,
      showValidationErrors: errors => ownContainer.showValidationErrors(errors)
    })
    const {
      isTransient,
      providesData,
      loadData,
      ensureData,
      submitResource,
      getPayloadData,
      emitButtonEvent
    } = requests
    const { getItemId, getItemLabel, getItemFormSchema } = useItemLabel({
      services,
      getContext: () => context,
      getSchema: () => sourceSchema.value,
      getDataPath: () => dataPath.value,
      isTransient: () => isTransient.value
    })
    const itemLabel = computed(() =>
      getItemLabel(sourceSchema.value, data.value, { extended: true })
    )

    const emitSchemaEvent = (event, options) =>
      schemaComponent.value?.emitEvent(event, options)

    const close = () => ownRoute.close()

    const getSubmitVerb = (present = true) =>
      isCreating.value
        ? present
          ? 'create'
          : 'created'
        : present
          ? 'submit'
          : 'submitted'

    const setupData = () => {
      if (isCreating.value) {
        // Drop the item that the form loaded before, and its pending load:
        requests.loadAbortController.value?.abort()
        loadedData.value = null
        const type = creationType.value
        createdData.value ||= initializeData(
          schema.value,
          type ? { type } : {},
          services
        )
      } else {
        ensureData()
      }
    }

    // Hold the item by its identity, in a draft unless the form mutates it.
    // When the item moves, the form follows it to its new route. Forms of list
    // items close once their item is gone.
    const setupSourceItem = ([item, path], [, previousPath] = []) => {
      if (isTransient.value) {
        if (toRaw(item) !== toRaw(original.value)) {
          // Other items at the same path mean that the data changed:
          const hasDataChanged = !!original.value && path === previousPath
          const { node, state } = parentRoute
          const params = (
            hasDataChanged &&
            node.findItemParams(
              ownRoute.node,
              { ...state, routeParams: routeParams.value },
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
            routeParams.value = { ...currentParams, ...params }
            router.replace({ name, params: routeParams.value, query, hash })
          } else if (hasDataChanged && isListSource(sourceSchema.value)) {
            close()
          } else {
            original.value = item ?? null
            if (!isMutating.value) {
              // Items share their child sources with their source, e.g. tree
              // items their children with the tree, which edits them:
              const transferables = getChildSourceSchemas(
                sourceSchema.value
              ).map(({ name }) => item?.[name])
              draft.value = item
                ? cloneWithUids(item, { transferables })
                : null
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
    // the draft's objects:
    const submitTransient = async (
      button,
      { onSuccess, onError, notifySuccess, notifyError }
    ) => {
      const parentModel = parentRoute.container.model
      const list = sourceData.value
      const item = cloneWithUids(data.value)
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
          if (isCreating.value) {
            parentModel.set(list, sourceKey.value, item)
          } else {
            parentModel.merge(list, sourceKey.value, item, sourceSchema.value)
          }
          schemaComponent.value.onChange()
        }
        onSuccess?.()
        await emitButtonEvent(button, 'success', { notify: notifySuccess })
      } else {
        const error = 'Could not submit transient item'
        onError?.(error)
        await emitButtonEvent(button, 'error', { notify: notifyError, error })
      }
      return success
    }

    const submit = async (button, {
      validate = true,
      closeForm = false
    } = {}) => {
      // The form may open another item or be left while the submit is pending:
      const submittedPath = path.value
      const submittedData = data.value
      // Wait for computed values that depend on pending loads:
      await waitUntilDataModelSettled(services)
      if (validate && !ownContainer.validate()) {
        return false
      }
      const { editCount } = ownDataModel

      const getVerb = present => verbs.value[getSubmitVerb(present)]
      // NOTE: `itemLabel` is HTML, the other values need to be escaped:
      const notifySubmitError = (error, message = null) => {
        const verb = getVerb(true)
        admin.notify({
          type: 'error',
          error,
          title: 'Request Error',
          html: message
            ? [`Unable to ${verb} ${itemLabel.value}:`, escapeHtml(message)]
            : `Unable to ${verb} ${itemLabel.value}.`
        })
      }
      const callbacks = {
        onSuccess: () => emitSchemaEvent(getSubmitVerb()),
        onError: error => emitSchemaEvent('error', { context: { error } })
      }

      // Allow buttons to override both method and resource path to submit to:
      let method = isCreating.value ? 'post' : 'patch'
      let resource = requests.getResource({ method })
      const buttonResource = getResource(button.schema.resource, {
        parent: resource
      })
      resource = buttonResource || resource
      method = resource?.method || method
      let success
      if (!buttonResource && isTransient.value) {
        success = await submitTransient(button, {
          ...callbacks,
          notifySuccess: () => {
            const verb = getVerb(false)
            admin.notify({
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
        const payload = getPayloadData(button, method)
        success = await submitResource(button, resource, method, payload, {
          ...callbacks,
          onSuccess: response => {
            // Merge the response only into the data that was submitted:
            if (response && data.value === submittedData) {
              setData(response)
            }
            callbacks.onSuccess()
          },
          notifySuccess: () => {
            const verb = getVerb(false)
            admin.notify({
              type: 'success',
              title: `Successfully ${capitalize(verb)}`,
              html: `${itemLabel.value} was ${verb}.`
            })
          },
          // Errors without a message are notified without details:
          notifyError: error => notifySubmitError(error, getErrorMessage(error))
        })
        if (success) {
          // The source that lists the item loads it again:
          parentRoute.findSource(ownRoute.node.source)?.reload()
        }
      }
      if (success) {
        getDataModel().clearErrors(dataPath.value)
        // Edits made while saving stay dirty, and so do the responses of
        // buttons with resources in drafts:
        if (!isTransient.value || !buttonResource) {
          ownDataModel.markClean({ dataPath: '', editCount })
        }
        if (closeForm || button.closeForm) {
          navigateWithin(submittedPath, close)
        } else if (isCreating.value) {
          // Redirect to the form editing the newly created item:
          const id = getItemId(sourceSchema.value, submittedData)
          navigateWithin(submittedPath, () =>
            router.replace({
              path: resolvePath(`${submittedPath}/../${id}`),
              hash: router.currentRoute.value.hash // Keep the tab.
            })
          )
        }
      }
      return success
    }

    const ownResource = markRaw(
      new ResourceContext(
        reactive({
          verbs,
          getResource: requests.getResource,
          submit,

          get dataModel() {
            return getDataModel()
          }
        }),
        { route: parentRoute }
      )
    )
    provide('sourceSchema', sourceSchema)
    provide('source', null)
    provide('resource', ownResource)

    // Set up the data before the model, which writes into it:
    if (providesData.value || isCreating.value) {
      setupData()
    }
    // The item of the parent is handled by the parent's model:
    const ownDataModel = createDataModel({
      schema: () => schema.value,
      data: () => (isEditingSourceItem.value ? null : data.value),
      rootData: () => rootData.value,
      dataPath: () => dataPath.value,
      sourceSchema: () => sourceSchema.value,
      parent: () => parentRoute.container.model,
      canSave: () => hasSubmitButton(buttonSchemas.value)
    })
    // Watch once the model exists, as the draft takes over its errors. The path
    // tells changes of the data from changes of the route:
    watch(() => [sourceItem.value, path.value], setupSourceItem, {
      immediate: true
    })

    watch(
      router.currentRoute,
      (to, from) => {
        // Load the data of other items that the form navigates to:
        const { param } = ownRoute.node
        const toParam = to.params[param]
        const fromParam = from.params[param]
        // Created items are merged into the form, which opens them as they are:
        const isOpeningCreatedItem = (
          fromParam === 'create' &&
          !createdData.value &&
          getItemId(sourceSchema.value, data.value) === toParam
        )
        if (
          param &&
          providesData.value &&
          toParam !== 'create' &&
          toParam !== fromParam &&
          !isOpeningCreatedItem
        ) {
          loadData(true)
        }
      },
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      { flush: 'post' }
    )

    watch(isCreating, isCreating => {
      if (isCreating) {
        setupData()
      }
    })

    // Whether the route is the last one that needs its own router-view:
    const isLastUnnestedRoute = computed(() => {
      const record = router.currentRoute.value.matched.findLast(
        record => !record.meta.node?.isNestedForm
      )
      return routeContainer.routeRecord.value === record
    })

    return {
      ...routeContainer,
      ...requests,
      route: ownRoute,
      schema,
      data,
      dataPath,
      dataModel: computed(getDataModel),
      selectedTab,
      buttonSchemas,
      isNestedRoute,
      isLastUnnestedRoute,
      isActiveRoute: computed(
        () => routeContainer.isLastRoute.value || isLastUnnestedRoute.value
      ),
      itemLabelText: computed(() => getTextFromHtml(itemLabel.value)),
      setData
    }
  }
}
</script>
