<template lang="pug">
.dito-form.dito-scroll-parent(
  :class="{ 'dito-form-nested': isNestedRoute }"
  :data-resource="schemaPath"
)
  //- Only render a router-view here if this isn't the last data route and not a
  //- nested form route, which will appear elsewhere in its own view.
  DitoRouterView(
    v-if="!isLastUnnestedRoute && !isNestedRoute"
    v-show="!isActiveRoute"
    :routeLevel="route.level + 1"
  )
  //- NOTE: Nested form components are kept alive by using `v-show` instead of
  //- `v-if` here, so event handling and other things still work with nested
  //- editing.
  DitoFormInner(
    v-show="isActiveRoute"
    :nested="isNestedRoute"
    :label="itemLabelText"
  )
    //- Prevent implicit submission of the form, for example when typing enter
    //- in an input field.
    //- https://stackoverflow.com/a/51507806
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
import { computed, getCurrentInstance, markRaw, toRaw } from 'vue'
import {
  capitalize,
  assignDeeply,
  equals,
  escapeHtml
} from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import { useRouteContainer } from '../composables/useRouteContainer.ts'
import { useResource } from '../composables/useResource.ts'
import { useResourceSubmit } from '../composables/useResourceSubmit.ts'
import { useItemLabel } from '../composables/useItemLabel.ts'
import { useServices } from '../composables/useSchemaContext.ts'
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
import { DataModel } from '../utils/DataModel.ts'
import { transientNote } from '../utils/dialogs.js'
import { getTextFromHtml } from '../utils/html.js'

// @vue/component
export default DitoComponent.component('DitoForm', {
  provide() {
    // The components of the form don't continue the source of its parent,
    // e.g. of a tree that renders the forms of its items:
    return {
      sourceSchema: computed(() => this.sourceSchema),
      source: null,
      resource: this.ownResource
    }
  },

  setup() {
    // NOTE: The form's data is still a member of the component:
    const form = getCurrentInstance().proxy
    const routeContainer = useRouteContainer()
    const { ownContainer, ownRoute } = routeContainer
    // The components of the form don't see the source of its parent:
    const services = useServices({
      container: ownContainer,
      route: ownRoute,
      source: null,

      get resource() {
        return form.ownResource
      }
    })
    const { verbs: resourceVerbs, ...requests } = useResource({
      services,
      parentRoute: ownRoute.parent,
      getSchema: () => form.sourceSchema,
      getItemId: () => form.itemId,
      isTransient: providesData => !providesData,
      hasData: () => form.hasData,
      clearData: () => form.setData(null),
      // Keep the edits made while the data loaded, also in forms that can't
      // save them. The `load` event still fires, as the data did load:
      setLoadedData(data) {
        if (!form.dataModel.isEdited) {
          form.setData(data)
        }
      },
      emitLoad: () => form.emitSchemaEvent('load')
    })
    return {
      ...routeContainer,
      services,
      ...requests,
      resourceVerbs,
      ...useItemLabel({
        services,
        getContext: () => form.context,
        getSchema: () => form.sourceSchema,
        getDataPath: () => form.dataPath,
        isTransient: () => requests.isTransient.value
      }),
      ...useResourceSubmit({
        admin: services.admin,
        handleRequest: requests.handleRequest,
        getData: () => form.data,
        getItemLabel: () => form.itemLabel,
        showValidationErrors: errors =>
          ownContainer.showValidationErrors(errors)
      })
    }
  },

  data() {
    return {
      // The resource continues the one of the parent route:
      ownResource: markRaw(
        new ResourceContext(this, { route: this.parentRoute })
      ),
      loadedData: null,
      createdData: null,
      // The item in the data of the parent that the form edits, held by its
      // identity, and the copy of it that the form edits unless it mutates the
      // item, see `setupSourceItem()`:
      original: null,
      draft: null,
      // The selected tab of the form's schema, see `context.selectedTab`:
      selectedTab: null
    }
  },

  computed: {
    isForm() {
      return true
    },

    // The schema of the source of the form's item:
    sourceSchema() {
      return this.route.node.source.schema
    },

    // The form's components read its verbs through its `ResourceContext`:
    verbs() {
      const verbs = this.resourceVerbs
      const { isCreating, providesData } = this
      return {
        ...verbs,
        submit: isCreating ? verbs.create : verbs.save,
        submitted: isCreating ? verbs.created : verbs.saved,
        cancel: providesData ? verbs.cancel : verbs.close,
        cancelled: providesData ? verbs.cancelled : verbs.closed
      }
    },

    schema() {
      return this.getItemFormSchema(
        this.sourceSchema,
        this.data || (
          this.creationType
            ? // If there is no data yet but the type to create a new item is
              // is specified, provide a temporary empty object with just the
              // type set, so `getItemFormSchema()` can determine the form.
              { type: this.creationType }
            : null
        ),
        this.context
      )
    },

    buttonSchemas() {
      return getButtonSchemas(
        assignDeeply(
          {
            cancel: {
              type: 'button',
              events: {
                click: () => this.cancel()
              }
            },

            submit: !this.isMutating && {
              type: 'submit',
              // Submit buttons close the form by default:
              closeForm: true,
              events: {
                click: ({ submit }) => submit()
              }
            }
          },
          this.schema.buttons
        )
      )
    },

    // Whether the route is the last one that needs its own router-view, as it
    // isn't nested:
    isLastUnnestedRoute() {
      const record = this.$route.matched.findLast(
        record => !record.meta.node?.isNestedForm
      )
      return this.routeRecord === record
    },

    isNestedRoute() {
      return this.route.node.isNestedForm
    },

    isActiveRoute() {
      return this.isLastRoute || this.isLastUnnestedRoute
    },

    // vue-router can't map several parameters of the same name to several
    // components, see https://github.com/vuejs/vue-router/issues/1345
    param() {
      return this.$route.params[this.route.node.param] ?? null
    },

    isCreating() {
      return this.param === 'create'
    },

    isMutating() {
      // When `sourceSchema.mutate` is true, the form edits the inherited data
      // directly instead of making a copy for persistence upon submission.
      // See `inheritedData()` computed property for more details.
      return !!this.sourceSchema.mutate
    },

    // Whether the form edits the item in the data of its parent directly,
    // unlike mutating forms that create their item or load it themselves.
    isEditingSourceItem() {
      return this.isMutating && this.data === this.inheritedData
    },

    // @override DitoMixin.dataModel()
    // Forms that edit the item of their parent edit it through its model:
    dataModel() {
      return this.isEditingSourceItem
        ? this.parentRoute.container.model
        : this.ownDataModel
    },

    // Whether leaving the form loses changes. Forms that edit the item of their
    // parent leave their changes in the parent's data, which isn't left:
    isDirty() {
      return !this.isEditingSourceItem && this.container.isDirty
    },

    // @override DitoMixin.source()
    // The callbacks of the form don't see the source of its parent either:
    source() {
      return null
    },

    creationType() {
      // The type of form to create, if there are multiple forms to choose from.
      return this.$route.query.type
    },

    itemId() {
      return this.isCreating
        ? null
        : this.param ?? null
    },

    method() {
      return this.isCreating ? 'post' : 'patch'
    },

    breadcrumb() {
      const { verbs } = this
      return (
        this.schema.breadcrumb ||
        `${capitalize(this.isCreating ? verbs.create : verbs.edit)} ${
          this.getLabel(this.schema)
        }`
      )
    },

    data() {
      // Return different data "containers" based on different scenarios:
      // 1. createdData, if we're in a form for a newly created object.
      // 2. loadedData, if the form itself is the root of the data (e.g. when
      //    directly loading an editing root).
      // 3. The data inherited from the parent, which itself may be either a
      //    view that loaded the data, or a form that either loaded the data, or
      //    also inherited it from its parent: a draft of the item, which is
      //    merged into it when it's applied, see `submitTransient()`.
      return this.createdData || this.loadedData || this.inheritedData || null
    },

    dataPath() {
      // Forms that load their own data start a new data path:
      return this.isTransient
        ? appendDataPath(
            this.parentRoute.dataPath,
            this.sourceLocation?.dataPath ?? ''
          )
        : ''
    },

    // @override DitoMixin.rootData()
    // The data that `dataPath` is relative to. Forms of items in the data of
    // their parent read the parent's root data, with their draft in place of
    // the item, and read-only elsewhere:
    rootData() {
      const { data, parentRoute } = this
      return this.isTransient
        ? this.isMutating || !this.sourceData
          ? parentRoute.rootData
          : createDraftRoot(parentRoute.rootData, this.dataPath, data)
        : data
    },

    componentPath() {
      // Nested forms continue the component path of the source that displays
      // their item in the parent route, e.g. `main/chapters/1`. Forms that
      // load their own data start a new one, like their data path.
      const { parentRoute } = this
      return this.isTransient
        ? getComponentPathByDataPath(
            parentRoute.schema,
            parentRoute.state.data,
            this.dataPath,
            {
              dataPath: parentRoute.dataPath,
              componentPath: parentRoute.componentPath,
              services: this,
              rootData: parentRoute.rootData
            }
          )
        : ''
    },

    // The item of the form in the data of its parent route, found through the
    // parameters of the form's own route, also while it's left:
    sourceLocation() {
      const { node, state } = this.parentRoute
      return state.data
        ? node.findItem(this.route.node, {
            ...state,
            // The parameters of the form's own route include its item:
            routeParams: this.routeParams
          })
        : null
    },

    sourceData() {
      // The parent data that holds the form's item, at `sourceKey`.
      return this.sourceLocation?.data ?? null
    },

    sourceKey() {
      return this.sourceLocation?.key ?? null
    },

    sourceItem() {
      return this.sourceData && this.sourceKey !== null
        ? this.sourceData[this.sourceKey]
        : undefined
    },

    inheritedData() {
      // With `sourceSchema.mutate`, the form edits the item directly:
      return this.isTransient
        ? this.isMutating
          ? this.sourceItem
          : this.draft
        : undefined
    },

    hasData() {
      return !!this.data
    },

    itemLabel() {
      return this.getItemLabel(this.sourceSchema, this.data, { extended: true })
    },

    // `itemLabel` is HTML, while the `aria-label` of the form is text:
    itemLabelText() {
      return getTextFromHtml(this.itemLabel)
    }
  },

  watch: {
    $route: {
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      flush: 'post',
      handler(to, from) {
        // Reload form data when navigating to a different entity in same form.
        // The create route sets up a new item instead, see `setupData()`.
        const { param } = this.route.node
        const toParam = to.params[param]
        const fromParam = from.params[param]
        // After submitting a new item, `setData()` merged the created one into
        // it, which the form then opens without loading it, see `submit()`.
        const isOpeningCreatedItem = (
          fromParam === 'create' &&
          !this.createdData &&
          this.getItemId(this.sourceSchema, this.data) === toParam
        )
        if (
          param &&
          this.providesData &&
          toParam !== 'create' &&
          toParam !== fromParam &&
          !isOpeningCreatedItem
        ) {
          this.loadData(true)
        }
      }
    },

    isCreating(isCreating) {
      // Set up the data to create when navigating to the create route, e.g.
      // from another item in the same form, or when redirected to it by the
      // `sourceItem` watcher.
      if (isCreating) {
        this.setupData()
      }
    }
  },

  created() {
    // Set up the data before the model, which writes into it. Forms that create
    // their item set it up too, also without a resource:
    if (this.providesData || this.isCreating) {
      this.setupData()
    }
    // Writes defaults and computed values into the form's data, resolves
    // options and tracks whether the data is dirty, see `DataModel`. The item
    // of the parent is handled by the parent's model, see `dataModel`:
    this.ownDataModel = markRaw(
      new DataModel({
        schema: () => this.schema,
        data: () => (this.isEditingSourceItem ? null : this.data),
        rootData: () => this.rootData,
        dataPath: () => this.dataPath,
        sourceSchema: () => this.sourceSchema,
        parent: () => this.parentRoute.container.model,
        canSave: () => hasSubmitButton(this.buttonSchemas),
        services: this.services
      })
    )
    // Watch the item after the model is created, as the draft takes over the
    // item's errors, and along with the path of the form, to tell changes of
    // the data from changes of the route:
    this.$watch(
      () => [this.sourceItem, this.path],
      this.setupSourceItem,
      { immediate: true }
    )
  },

  beforeUnmount() {
    // Stop the model before the component's own watchers are stopped, as the
    // model's watchers aren't part of the component, see `DataModel`.
    this.ownDataModel.stop()
  },

  methods: {
    emitSchemaEvent(event, params) {
      return this.$refs.schema?.emitEvent(event, params)
    },

    // Hold the item of the form by its identity, in a draft unless the form
    // mutates it. When the data changes and the item moves, e.g. as an earlier
    // item or the item of a parent form moved or was removed, the form follows
    // it to its new route. Forms of list items close once their item is gone,
    // while objects keep their place.
    setupSourceItem([item, path], [, previousPath] = []) {
      if (this.isTransient) {
        const { original } = this
        if (toRaw(item) !== toRaw(original)) {
          // Other items at the same path mean that the data changed:
          const hasDataChanged = !!original && path === previousPath
          const { node, state } = this.parentRoute
          const params = (
            hasDataChanged &&
            node.findItemParams(
              this.route.node,
              { ...state, routeParams: this.routeParams },
              original
            )
          )
          if (params) {
            // Change the parameters first, so that the form isn't left on the
            // way, see `beforeRouteChange()`:
            const { name, query, hash } = this.$route
            const routeParams = { ...this.$route.params, ...params }
            this.routeParams = routeParams
            this.$router.replace({ name, params: routeParams, query, hash })
          } else if (hasDataChanged && isListSource(this.sourceSchema)) {
            this.close()
          } else {
            this.original = item ?? null
            if (!this.isMutating) {
              // Edit a draft of the item, with its uids and errors, e.g. of
              // the server for the parent's data, see `submitTransient()`.
              // Items share their child sources with their source, e.g. tree
              // items their children with the tree, which edits them:
              const transferables = getChildSourceSchemas(
                this.sourceSchema
              ).map(({ name }) => item?.[name])
              this.draft = item ? cloneWithUids(item, { transferables }) : null
              this.copyErrors()
            }
          }
        }
        if (
          item === null &&
          !this.isCreating &&
          isObjectSource(this.sourceSchema)
        ) {
          // If data of an object source is null, redirect to its create
          // route.
          this.$router.push({ path: `${this.path}/create` })
        }
      }
    },

    // Copy the errors of the item in the parent's model into the draft:
    copyErrors() {
      if (this.draft) {
        this.ownDataModel.copyErrors(
          this.parentRoute.container.model,
          this.draft
        )
      }
    },

    setupData() {
      if (this.isCreating) {
        // Drop the data of the item that the form loaded before, e.g. when
        // navigating from `/items/1` to `/items/create`, so that it doesn't
        // determine the form schema of the new item. Its load may still be
        // pending, and would replace the new item once it completes:
        this.loadAbortController?.abort()
        this.loadedData = null
        const type = this.creationType
        this.createdData ||= initializeData(
          this.schema,
          type ? { type } : {},
          this
        )
      } else {
        this.ensureData()
      }
    },

    setData(data) {
      if (this.isTransient) {
        // Forms of items in the data of their parent merge the data into the
        // item like an edit, which reaches the parent once the draft is
        // applied, or right away if they mutate the item:
        if (!equals(this.data, data)) {
          mergeData(this.schema, this.data, data, {
            services: this,
            shouldKeepSourcesWithResource: true
          })
          this.dataModel.markEdited()
        }
      } else {
        // Merge data from the server into the form's data, e.g. the response
        // of a save, so that its objects keep their identity:
        this.loadedData =
          this.data && data
            ? this.dataModel.mergeFromServer(data)
            : data
        this.createdData = null
      }
      return this.data
    },

    async cancel() {
      return this.close()
    },

    async close() {
      return this.route.close()
    },

    getSubmitVerb(present = true) {
      return this.isCreating
        ? present
          ? 'create'
          : 'created'
        : present
          ? 'submit'
          : 'submitted'
    },

    async submit(button, { validate = true, closeForm = false } = {}) {
      // The form may open another item or be left while the submit is pending:
      const { path, data } = this
      // Wait for computed values that depend on pending loads, e.g. options.
      await this.waitUntilDataModelSettled()
      if (validate && !this.container.validate()) {
        return false
      }
      // The edits that the submit carries:
      const { editCount } = this.ownDataModel

      const getVerb = present => this.verbs[this.getSubmitVerb(present)]
      // NOTE: The notifications pass `html`, as `itemLabel` is HTML with
      // escaped item values, see `getItemLabel()`. Other values that they
      // include need to be escaped too.
      const notifySubmitError = (error, message = null) => {
        const verb = getVerb(true)
        const { itemLabel } = this
        this.admin.notify({
          type: 'error',
          error,
          title: 'Request Error',
          html: message
            ? [`Unable to ${verb} ${itemLabel}:`, escapeHtml(message)]
            : `Unable to ${verb} ${itemLabel}.`
        })
      }
      const callbacks = {
        onSuccess: () => this.emitSchemaEvent(this.getSubmitVerb()),
        onError: error =>
          this.emitSchemaEvent('error', {
            context: { error }
          })
      }

      // Allow buttons to override both method and resource path to submit to:
      let { method } = this
      let resource = this.getResource({ method })
      const buttonResource = getResource(button.schema.resource, {
        parent: resource
      })
      resource = buttonResource || resource
      method = resource?.method || method
      let success
      if (!buttonResource && this.isTransient) {
        success = await this.submitTransient(button, {
          ...callbacks,
          notifySuccess: () => {
            const verb = getVerb(false)
            const { itemLabel } = this
            this.admin.notify({
              type: 'info',
              title: this.isCreating
                ? `Item ${capitalize(verb)}`
                : `Change ${capitalize(verb)}`,
              html: [
                this.isCreating
                  ? `${itemLabel} was ${verb}.`
                  : `Changes to ${itemLabel} were ${verb}.`,
                transientNote
              ]
            })
          },
          notifyError: error => notifySubmitError(error)
        })
      } else {
        const payload = this.getPayloadData(button, method)
        success = await this.submitResource(button, resource, method, payload, {
          ...callbacks,
          onSuccess: response => {
            // Merge the response only into the data that was submitted:
            if (response && this.data === data) {
              this.setData(response)
            }
            callbacks.onSuccess()
          },
          notifySuccess: () => {
            const verb = getVerb(false)
            this.admin.notify({
              type: 'success',
              title: `Successfully ${capitalize(verb)}`,
              html: `${this.itemLabel} was ${verb}.`
            })
          },
          // Errors without a message are notified without details:
          notifyError: error => notifySubmitError(error, getErrorMessage(error))
        })
        if (success) {
          // The item changed on the server, so the source that lists it needs
          // to load it again, if the parent route renders it, unlike views,
          // which render the form instead:
          this.parentRoute.findSource(this.route.node.source)?.reload()
        }
      }
      if (success) {
        this.dataModel.clearErrors(this.dataPath)
        // The saved or applied data isn't dirty, also without a response with
        // data, and before the closing below, but edits made meanwhile are.
        // Drafts hold the responses of buttons with resources like edits, see
        // `setData()`:
        if (!this.isTransient || !buttonResource) {
          this.ownDataModel.markClean({ dataPath: '', editCount })
        }
        if (closeForm || button.closeForm) {
          this.navigateWithin(path, () => this.close())
        } else if (this.isCreating) {
          // Redirect to the form editing the newly created item:
          const id = this.getItemId(this.sourceSchema, data)
          this.navigateWithin(path, () =>
            this.$router.replace({
              path: resolvePath(`${path}/../${id}`),
              // Preserve hash for tabs:
              hash: this.$route.hash
            })
          )
        }
      }
      return success
    },

    async submitTransient(button, {
      onSuccess,
      onError,
      notifySuccess,
      notifyError
    }) {
      // Merge the draft into its item in the parent's data, or add it as a new
      // item. A copy is applied, so that the parent never shares the draft's
      // data, also while the form stays open:
      const { sourceData, sourceKey, sourceSchema } = this
      const parentModel = this.parentRoute.container.model
      const item = cloneWithUids(this.data)
      const success = !!sourceData
      if (success) {
        if (this.isCreating && !isObjectSource(sourceSchema)) {
          // The data path of new items ends with `create` in their list:
          const dataPath = getParentDataPath(this.dataPath)
          parentModel.insert(
            { schema: sourceSchema, list: sourceData, dataPath },
            sourceData.length,
            item
          )
        } else {
          if (this.isCreating) {
            parentModel.set(sourceData, sourceKey, item)
          } else {
            parentModel.merge(sourceData, sourceKey, item, sourceSchema)
          }
          this.$refs.schema.onChange()
        }
        onSuccess?.()
        await this.emitButtonEvent(button, 'success', {
          notify: notifySuccess
        })
      } else {
        const error = 'Could not submit transient item'
        onError?.(error)
        await this.emitButtonEvent(button, 'error', {
          notify: notifyError,
          error
        })
      }
      return success
    }
  }
})
</script>
