<template lang="pug">
.dito-form.dito-scroll-parent(
  :class="{ 'dito-form--embedded': isEmbeddedRoute }"
  :data-resource="schemaPath"
)
  //- Embedded forms render inside the components that claimed them:
  DitoRouterView(
    v-if="!isActiveRoute"
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
      //- The component of forms that lay out their components:
      template(
        v-if="schema.component"
        #default
      )
        component(
          :is="schema.component"
          :schema="schema"
          :context="context"
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
import { computed, inject, ref, toRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { capitalize, pickBy } from '@ditojs/utils'
import {
  useRouteContainer,
  useRouteRecord
} from '../composables/useRouteContainer.ts'
import { useResource } from '../composables/useResource.ts'
import { useForm } from '../composables/useForm.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { adminContextKey } from '../utils/keys.ts'
import { isListSource, isObjectSource } from '../utils/schema/structure.js'
import { getItemFormSchema, hasSubmitButton } from '../utils/schema/lookup.js'
import { getParentDataPath } from '../utils/data.js'
import { cloneWithUids } from '../utils/uid.js'
import {
  getChildSourceSchemas,
  getItemAdapter
} from '../utils/schema/types.ts'
import { createDraftRoot } from '../utils/draftRoot.ts'

export default {
  setup() {
    const router = useRouter()
    const adminContext = inject(adminContextKey)
    const route = useRouteRecord()
    const { claim, parent: parentRouteContext } = route
    const parentDataContext = parentRouteContext.dataContext

    // The source of the item, and what the route says about it:
    const sourceSchema = computed(() => claim.value.schema)
    const itemAdapter = computed(() => getItemAdapter(sourceSchema.value))
    const param = computed(() => claim.value.param)
    const isCreating = computed(() => param.value === 'create')
    const isMutating = computed(() => !!sourceSchema.value.mutate)
    const creationType = computed(() => router.currentRoute.value.query.type)
    const itemId = computed(() => (isCreating.value ? null : param.value))
    const isEmbeddedRoute = computed(() => claim.value.isEmbedded)

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

    // The item of the form in the data of its parent route:
    const sourceLocation = computed(() => claim.value.location)
    const sourceData = computed(() => sourceLocation.value.data)
    const sourceKey = computed(() => sourceLocation.value.key)
    const sourceItem = computed(() =>
      sourceData.value && sourceKey.value !== null
        ? sourceData.value[sourceKey.value]
        : undefined
    )
    // Forms that load their own data start a new data path:
    const dataPath = computed(() =>
      isTransient.value ? sourceLocation.value.dataPath : ''
    )
    const {
      routeContext,
      dataContext,
      model,
      store,
      schemaPath,
      navigateWithin,
      replaceWithin
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
      // Forms of items in the data of their parent continue the component path
      // of their source, e.g. `main/chapters/1`:
      componentPath: () =>
        isTransient.value ? sourceLocation.value.componentPath : '',
      isCreating: () => isCreating.value,
      isTransient: () => isTransient.value,
      isMutating: () => isMutating.value,
      parentModel: () => parentDataContext.model,
      isEditingParentItem: () => isEditingParentItem.value,
      getParentItem: () => sourceItem.value,
      itemLabel: () => form.itemLabelText.value,
      canSave: () => hasSubmitButton(form.buttonSchemas.value),
      resetItem: data => resetItem(data),
      mergeItem: data => mergeItem(data),
      copyErrors: () => copyErrors(),
      breadcrumb: () => (
        schema.value.breadcrumb ||
        `${
          capitalize(
            isCreating.value ? form.verbs.value.create : form.verbs.value.edit
          )
        } ${form.getLabelText(schema.value)}`
      ),
      verbs: () => form.verbs.value,
      resourceContext: requests.resourceContext,
      // The components of the form don't see the source of its parent, e.g.
      // of a tree that renders the forms of its items:
      sourceContext: null,
      submit: (button, options) =>
        submit(button ?? form.getSubmitButton(), options)
    })
    useComponentPath(
      () => dataPath.value,
      () => dataContext.componentTree.root
    )

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
    const close = () => routeContext.close()
    const form = useForm({
      requests,
      dataContext,
      model,
      sourceSchema: () => sourceSchema.value,
      creationType: () => creationType.value,
      close,
      submitTransient: (button, options) => submitTransient(button, options)
    })
    const {
      context,
      emitSchemaEvent,
      getItemId,
      buttonSchemas,
      itemLabelText,
      loadData,
      createData
    } = form

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
      return model.mergeFromServer(value, {
        isReset: true,
        item: isEditingParentItem.value ? data.value : null
      })
    }

    // Merge values from the server into the item like `resetItem()`, but only
    // the values in the data and their errors, which isn't an edit:
    const mergeItem = value =>
      model.mergeFromServer(value, {
        isPartial: true,
        item: isEditingParentItem.value ? data.value : null
      })

    // Copy the errors of the item in the parent's model into the draft:
    const copyErrors = () => {
      const draft = hasDraft.value ? model.data : null
      if (draft) {
        if (itemAdapter.value) {
          // The list holds the errors of its primitives:
          model.errors.copyValue(
            parentDataContext.model.errors,
            dataPath.value,
            { data: draft, name: itemAdapter.value.name }
          )
        } else {
          model.errors.copy(parentDataContext.model.errors, draft)
        }
      }
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
          const itemClaim = (
            hasDataChanged &&
            claim.value.claimItem(original.value)
          )
          if (itemClaim) {
            // Keep the path below the form, e.g. of the form of a child item:
            const { path, query } = router.currentRoute.value
            replaceWithin({
              path: itemClaim.path + path.slice(routeContext.path.length),
              query
            })
          } else if (hasDataChanged && isListSource(sourceSchema.value)) {
            // The removal was confirmed, so the draft goes without asking:
            model.markClean()
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
          router.replace({ path: `${path}/create` })
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

    // Leaving the route waits for pending submits:
    const submit = (button, options = {}) => {
      // The form may open another item or be left while the submit is pending:
      const submittedPath = routeContext.path
      const submittedData = data.value
      return dataContext.model.trackPendingSubmit(
        (async () => {
          const { success, isTransientSubmit } = await form.submitData(
            button,
            options
          )
          if (success) {
            if (!isTransientSubmit) {
              // The source that lists the item loads it again, if it's mounted,
              // or else once it mounts:
              claim.value.source?.reload()
            }
            if (options.closeForm || button.closeForm) {
              navigateWithin(submittedPath, close)
            } else if (isCreating.value) {
              // Redirect to the form editing the newly created item. Items in
              // the data of the parent are addressed by their index, objects by
              // the form without parameter:
              const id = !isTransientSubmit
                ? getItemId(sourceSchema.value, submittedData)
                : isObjectSource(sourceSchema.value)
                  ? null
                  : sourceData.value.length - 1
              navigateWithin(submittedPath, () => {
                const { sourcePath } = claim.value
                router.replace(id !== null ? `${sourcePath}/${id}` : sourcePath)
              })
            }
          }
          return success
        })()
      )
    }

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
      param,
      (toParam, fromParam) => {
        // Load the data of other items that the form navigates to. Created
        // items are merged into the form, which opens them as they are:
        const isOpeningCreatedItem = (
          fromParam === 'create' &&
          getItemId(sourceSchema.value, data.value) === toParam
        )
        if (
          providesData.value &&
          toParam !== 'create' &&
          !isOpeningCreatedItem
        ) {
          loadData()
        }
      },
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      { flush: 'post' }
    )

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
      isActiveRoute: computed(() => routeContext.isActive),
      itemLabelText,
      context
    }
  }
}
</script>

<style lang="scss">
.dito-form {
  &--embedded {
    // No scrolling inside embedded forms, and prevent open .multiselect from
    // being cropped.
    overflow: visible;
  }
}
</style>
