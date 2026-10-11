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
    :routeLevel="routeLevel + 1"
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
      :meta="meta"
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
          :meta="meta"
          :store="store"
          :disabled="isLoading"
        )
</template>

<script>
import { markRaw } from 'vue'
import {
  clone,
  capitalize,
  assignDeeply,
  escapeHtml
} from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import ResourceMixin from '../mixins/ResourceMixin.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { isObjectSource } from '../utils/schema/structure.js'
import {
  getButtonSchemas,
  hasSubmitButton
} from '../utils/schema/lookup.js'
import { getComponentPathByDataPath } from '../utils/schema/data.js'
import { appendDataPath } from '../utils/data.js'
import { resolvePath } from '../utils/path.js'
import { getErrorMessage } from '../utils/request.js'
import { transferUids } from '../utils/uid.js'
import { DataModel } from '../utils/DataModel.js'
import { transientNote } from '../utils/dialogs.js'
import { getTextFromHtml } from '../utils/html.js'

// @vue/component
export default DitoComponent.component('DitoForm', {
  mixins: [RouteMixin, ResourceMixin],

  data() {
    return {
      createdData: null,
      clonedData: undefined
    }
  },

  computed: {
    isForm() {
      return true
    },

    verbs() {
      // Add submit / submitted to the verbs returned by ResourceMixin
      // NOTE: These get passed on to children through:
      // `provide() ... { $verbs: () => this.verbs }` in ResourceMixin
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
                click: ({ component: button }) => button.submit()
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
        ? this.parentRouteComponent.dataModel
        : this.ownDataModel
    },

    selectedTab() {
      return this.mainSchemaComponent?.selectedTab || null
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
      //    also inherited it from its parent. Note that we use a clone of it,
      //    so, data changes aren't applied until setSourceData() is called.
      return this.createdData || this.loadedData || this.inheritedData || null
    },

    // The view that the form is nested in: the closest parent route component
    // that is a view, past the parent forms, and not the menus around the view,
    // which are rendered by views as well.
    parentViewComponent() {
      let component = this.parentRouteComponent
      while (component && !component.isView) {
        component = component.parentRouteComponent
      }
      return component
    },

    // The route component that holds the root data of the form's data path:
    // the closest one that provides its own data, or else the view, which
    // holds the data of its components also when they have no resources.
    dataRootComponent() {
      return this.dataComponent ?? this.parentViewComponent
    },

    dataPath() {
      // Forms that load their own data start a new data path:
      return this.isTransient
        ? appendDataPath(
            this.parentRouteComponent.dataPath,
            this.sourceLocation?.dataPath ?? ''
          )
        : ''
    },

    // @override DitoMixin.rootData()
    // The data that `dataPath` is relative to, also in views without resources,
    // which aren't data components.
    rootData() {
      return this.dataRootComponent?.data
    },

    componentPath() {
      // Nested forms continue the component path of the source that displays
      // their item in the parent route component, e.g. `main/chapters/1`.
      // Forms that load their own data start a new one, like their data path.
      const { parentRouteComponent } = this
      return this.isTransient && parentRouteComponent
        ? getComponentPathByDataPath(
            parentRouteComponent.isView
              ? parentRouteComponent.viewSchema
              : parentRouteComponent.schema,
            parentRouteComponent.data,
            this.sourceLocation?.dataPath ?? '',
            {
              componentPath: parentRouteComponent.componentPath,
              component: this,
              rootData: this.rootData
            }
          )
        : ''
    },

    // The item of the form in the data of its parent route component, found
    // through the parameters of the form's own route, also while it's left:
    sourceLocation() {
      const parent = this.parentRouteComponent
      return parent?.data
        ? parent.meta.node.findItem(this.meta.node, {
            ...parent.routeState,
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
      // Data inherited from parent, and cloned to protect against reactive
      // changes until changes are applied through setSourceData(), unless
      // `sourceSchema.mutate` is true, in which case data is mutated directly.
      // See the `sourceItem` watcher.
      return this.isTransient
        ? this.isMutating
          ? this.sourceItem
          : this.clonedData
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
        const param = this.meta?.node.param
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
        component: this,
        getSchema: () => this.schema,
        getData: () => (this.isEditingSourceItem ? null : this.data),
        canSave: () => hasSubmitButton(this.buttonSchemas)
      })
    )
    // Watch the item after the model is created, as the copy takes over the
    // item's errors:
    this.$watch('sourceItem', this.setupSourceItem, { immediate: true })
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

    setupSourceItem(item) {
      if (this.isTransient) {
        if (!this.isMutating) {
          // Edit a copy of the inherited item, so that changes are only
          // applied through setSourceData(). Copy it again whenever the item
          // itself is replaced, e.g. after applying the changes. The copy
          // keeps the uids of the new items, see `transferUids()`, and the
          // errors of the item, e.g. of the server for the parent's data.
          const clonedData = clone(item)
          transferUids(item, clonedData)
          this.ownDataModel.copyErrors(
            this.parentRouteComponent.dataModel,
            item,
            clonedData
          )
          this.clonedData = clonedData
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

    // Reveals the errors of the form's data, see `DitoSchema.revealErrors()`.
    // Forms that edit a copy of their item take over its errors first, also
    // when they're open already, e.g. when the parent shows its errors.
    revealErrors() {
      if (this.isTransient && !this.isMutating) {
        this.ownDataModel.copyErrors(
          this.parentRouteComponent.dataModel,
          this.sourceItem,
          this.clonedData
        )
      }
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

    // Returns the source component that loads the form's item through its
    // resource in the parent route component, e.g. a list in a parent form, or
    // `null` if it isn't rendered, e.g. the list of a view, which renders the
    // form instead.
    getParentSourceComponent() {
      const sourceNode = this.meta.node.source
      return (
        this.parentRouteComponent?.mainSchemaComponent?.components.find(
          component => (
            component.providesData &&
            component.sourceNode === sourceNode
          )
        ) ?? null
      )
    },

    setSourceData(data) {
      if (this.sourceData && this.sourceKey !== null) {
        // Keep the uids of new items, which key their components and stores,
        // see `transferUids()`. The applied data is processed from the form's
        // data, which holds them since cloning the item.
        transferUids(this.data, data)
        // The forms of tree items don't contain their children, which are
        // edited in the tree, so keep the children of the applied item:
        const childrenName = this.sourceSchema.children?.name
        const { sourceItem } = this
        if (
          childrenName &&
          !(childrenName in data) &&
          sourceItem &&
          childrenName in sourceItem
        ) {
          data[childrenName] = sourceItem[childrenName]
        }
        this.parentRouteComponent.dataModel.set(
          this.sourceData,
          this.sourceKey,
          data
        )
        this.mainSchemaComponent.onChange()
        return true
      }
      return false
    },

    addSourceData(data) {
      const { sourceData } = this
      if (isObjectSource(this.sourceSchema)) {
        return this.setSourceData(data)
      } else if (sourceData) {
        this.parentRouteComponent.dataModel.insert(
          sourceData,
          sourceData.length,
          data
        )
        return true
      } else {
        return false
      }
    },

    // Required by ResourceMixin, see its contract.
    clearData() {
      this.setData(null)
    },

    // Required by ResourceMixin, see its contract.
    setData(data) {
      // setData() is called after submit when data has changed.
      if (this.isTransient) {
        // For components with transient data, modify this.sourceData, and
        // return the item stored there, as the form's own data is a copy.
        this.setSourceData(data)
        return this.sourceItem
      } else {
        // Merge data from the server into the form's data, e.g. the response
        // of a save, so that its objects keep their identity:
        this.loadedData =
          this.data && data
            ? this.dataModel.mergeFromServer(data)
            : data
        this.createdData = null
        return this.data
      }
    },

    async cancel() {
      return this.close()
    },

    async close() {
      return this.navigate(this.parentRouteComponent.path)
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

      const getVerb = present => this.verbs[this.getSubmitVerb(present)]
      // NOTE: The notifications pass `html`, as `itemLabel` is HTML with
      // escaped item values, see `getItemLabel()`. Other values that they
      // include need to be escaped too.
      const notifySubmitError = (error, message = null) => {
        const verb = getVerb(true)
        const { itemLabel } = this
        this.notify({
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
      const data = this.getPayloadData(button, method)
      let success
      if (!buttonResource && this.isTransient) {
        success = await this.submitTransient(button, resource, method, data, {
          ...callbacks,
          notifySuccess: () => {
            const verb = getVerb(false)
            const { itemLabel } = this
            this.notify({
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
        success = await this.submitResource(button, resource, method, data, {
          ...callbacks,
          setData: true,
          notifySuccess: () => {
            const verb = getVerb(false)
            this.notify({
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
          // to load it again.
          this.getParentSourceComponent()?.reloadData()
        }
      }
      if (success) {
        this.resetValidation()
        // The saved or applied data isn't dirty, also without a response with
        // data, and before the closing below:
        this.ownDataModel.markClean()
        if (closeForm || button.closeForm) {
          this.close()
        } else if (this.isCreating) {
          // Redirect to the form editing the newly created item:
          const id = this.getItemId(this.schema, this.data)
          this.$router.replace({
            path: resolvePath(`${this.path}/../${id}`),
            // Preserve hash for tabs:
            hash: this.$route.hash
          })
        }
      }
      return success
    },

    async submitTransient(button, _resource, _method, data, {
      onSuccess,
      onError,
      notifySuccess,
      notifyError
    }) {
      // Handle the default "submitting" of transient, nested data:
      const success = this.isCreating
        ? this.addSourceData(data)
        : this.setSourceData(data)
      if (success) {
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
