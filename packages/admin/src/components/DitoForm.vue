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
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :store="store"
      :padding="isNestedRoute ? 'nested' : 'root'"
      :active="isActiveRoute"
      :disabled="isLoading"
      :scrollable="!isNestedRoute"
      generateLabels
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
import { markRaw, toRaw } from 'vue'
import {
  capitalize,
  assignDeeply,
  equals,
  escapeHtml
} from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import ResourceMixin from '../mixins/ResourceMixin.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { isListSource, isObjectSource } from '../utils/schema/structure.js'
import {
  getButtonSchemas,
  hasSubmitButton
} from '../utils/schema/lookup.js'
import { getComponentPathByDataPath } from '../utils/schema/data.js'
import { appendDataPath, getParentDataPath } from '../utils/data.js'
import { resolvePath } from '../utils/path.js'
import { getErrorMessage } from '../utils/request.js'
import { cloneWithUids } from '../utils/uid.js'
import { mergeData } from '../utils/mergeData.ts'
import { createDraftRoot } from '../utils/draftRoot.ts'
import { DataModel } from '../utils/DataModel.ts'
import { transientNote } from '../utils/dialogs.js'
import { getTextFromHtml } from '../utils/html.js'

// @vue/component
export default DitoComponent.component('DitoForm', {
  mixins: [RouteMixin, ResourceMixin],

  provide() {
    // The components of the form don't continue the source of its parent,
    // e.g. of a tree that renders the forms of its items:
    return {
      source: null
    }
  },

  data() {
    return {
      createdData: null,
      // The item in the data of the parent that the form edits, held by its
      // identity, and the copy of it that the form edits unless it mutates the
      // item, see `setupSourceItem()`:
      original: null,
      draft: null
    }
  },

  computed: {
    isForm() {
      return true
    },

    // @override SchemaParentMixin.sourceSchema()
    // The schema of the source of the form's item:
    sourceSchema() {
      return this.route.node.source.schema
    },

    verbs() {
      // Add submit / submitted to the verbs returned by ResourceMixin, which
      // the form's components read through its `ResourceContext`:
      const verbs = this.getVerbs()
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

    isActiveRoute() {
      return this.isLastRoute || this.isLastUnnestedRoute
    },

    isTransient() {
      return !this.providesData
    },

    isCreating() {
      // this.param is inherited from RouteMixin
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

    // @override RouteMixin.isDirty()
    // Forms that edit the item of their parent leave their changes in the
    // parent's data, which isn't left with them:
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

    breadcrumbPrefix() {
      return capitalize(this.isCreating ? this.verbs.create : this.verbs.edit)
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
            this.sourceLocation?.dataPath ?? '',
            {
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

    // Required by ResourceMixin, see its contract.
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
        // A new item that wasn't submitted is still in `createdData`, and is
        // replaced by the loaded item.
        const isOpeningCreatedItem = fromParam === 'create' && !this.createdData
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
        // The components of the form don't see the source of its parent:
        services: {
          admin: this.admin,
          container: this.ownContainer,
          route: this.ownRoute,
          source: null,
          resource: this.ownResource
        }
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
      return this.mainSchemaComponent?.emitEvent(event, params)
    },

    // @override ResourceMixin.getResource()
    getResource(options) {
      const resource = ResourceMixin.methods.getResource.call(this, options)
      return getMemberResource(this.itemId, resource) || resource
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
              // Tree items share their children with the tree, which edits
              // them:
              const children = item?.[this.sourceSchema.children?.name]
              this.draft = item
                ? cloneWithUids(item, { transferables: [children] })
                : null
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

    // Copies the errors of the item in the parent's model into the draft.
    copyErrors() {
      if (this.draft) {
        this.ownDataModel.copyErrors(
          this.parentRoute.container.model,
          this.draft
        )
      }
    },

    // Reveals the errors of the form's data, see `DitoSchema.revealErrors()`.
    // Drafts take over the errors of their item first, also when they're open
    // already, e.g. when the parent shows its errors.
    revealErrors() {
      this.copyErrors()
      return this.mainSchemaComponent.revealErrors()
    },

    // Required by ResourceMixin, see its contract.
    setupData() {
      if (this.isCreating) {
        // Drop the data of the item that the form loaded before, e.g. when
        // navigating from `/items/1` to `/items/create`, so that it doesn't
        // determine the form schema of the new item. Its load may still be
        // pending, and would replace the new item once it completes:
        this.loadAbortController?.abort()
        this.loadedData = null
        this.createdData ||= this.createData(this.schema, this.creationType)
      } else {
        this.ensureData()
      }
    },

    // @override ResourceMixin.setLoadedData()
    // Keep the edits made while the data loaded, also in forms that can't save
    // them. The `load` event still fires, as the data did load.
    setLoadedData(data) {
      if (!this.dataModel.isEdited) {
        this.setData(data)
      }
    },

    // Required by ResourceMixin, see its contract.
    clearData() {
      this.setData(null)
    },

    // Required by ResourceMixin, see its contract.
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
      // Wait for computed values that depend on pending loads, e.g. options.
      await this.waitUntilDataModelSettled()
      if (validate && !this.validateAll()) {
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
        const data = this.getPayloadData(button, method)
        success = await this.submitResource(button, resource, method, data, {
          ...callbacks,
          setData: true,
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
        this.resetValidation()
        // The saved or applied data isn't dirty, also without a response with
        // data, and before the closing below, but edits made meanwhile are.
        // Drafts hold the responses of buttons with resources like edits, see
        // `setData()`:
        if (!this.isTransient || !buttonResource) {
          this.ownDataModel.markClean({ editCount })
        }
        if (closeForm || button.closeForm) {
          this.navigateAfterSubmits(() => this.close())
        } else if (this.isCreating) {
          // Redirect to the form editing the newly created item:
          const id = this.getItemId(this.schema, this.data)
          this.navigateAfterSubmits(() =>
            this.$router.replace({
              path: resolvePath(`${this.path}/../${id}`),
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
          this.mainSchemaComponent.onChange()
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
