<template lang="pug">
.dito-form.dito-scroll-parent(
  :class="{ 'dito-form-nested': isNestedRoute }"
)
  // NOTE: Nested form components are kept alive by using `v-show` instead of
  // `v-if` here, so event handling and other things still work with nested
  // editing. Only render a router-view here if this isn't the last data route
  // and not a nested form route, which will appear elsewhere in its own view.
  router-view(
    v-if="!(isLastUnnestedRoute || isNestedRoute)"
    v-show="!isActive"
  )
  // Use a <div> for inlined forms, as we shouldn't nest actual <form> tags.
  component.dito-scroll(
    v-show="isActive"
    :is="isNestedRoute ? 'div' : 'form'"
    @submit.prevent
  )
    // Prevent implicit submission of the form, for example when typing enter
    // in an input field.
    // https://stackoverflow.com/a/51507806
    button(
      v-show="false"
      type="submit"
      disabled="true"
      aria-hidden="true"
    )
    dito-schema(
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="isLoading"
      :menuHeader="true"
    )
      dito-buttons.dito-buttons-round.dito-buttons-main.dito-buttons-large(
        slot="buttons"
        :buttons="buttonSchemas"
        :dataPath="dataPath"
        :data="data"
        :meta="meta"
        :store="store"
        :disabled="isLoading"
      )
</template>

<script>
import { clone, capitalize, parseDataPath, merge } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import RouteMixin from '../mixins/RouteMixin.js'
import ResourceMixin from '../mixins/ResourceMixin.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { getButtonSchemas, isObjectSource } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin, ResourceMixin],

  data() {
    return {
      createdData: null,
      clonedData: undefined,
      sourceKey: null,
      isForm: true
    }
  },

  computed: {
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
        // If there is no data yet, provide an empty object with just the right
        // type set, so the form can always be determined.
        this.data || { type: this.type },
        this.context
      ) || {} // Always return a schema object so we don't need to check for it.
    },

    buttonSchemas() {
      return getButtonSchemas(
        merge(
          {
            cancel: {
              type: 'button',
              events: {
                click: () => this.cancel()
              }
            },

            submit: !this.doesMutate && {
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

    isActive() {
      return this.isLastRoute || this.isLastUnnestedRoute
    },

    isTransient() {
      return !this.providesData
    },

    isCreating() {
      // this.param is inherited from RouteMixin
      return this.param === 'create'
    },

    isDirty() {
      return !this.doesMutate && !!this.mainSchemaComponent?.isDirty
    },

    selectedTab() {
      return this.mainSchemaComponent?.selectedTab || null
    },

    doesMutate() {
      // When `sourceSchema.mutate` is true, the form edits the inherited data
      // directly instead of making a copy for application upon submit.
      // See `inheritedData()` computed property for more details.
      return this.sourceSchema.mutate
    },

    type() {
      // The type of form to create, if there are multiple forms to choose from.
      return this.$route.query.type
    },

    itemId() {
      return this.isCreating
        ? null
        : (this.param ?? null)
    },

    method() {
      return this.isCreating ? 'post' : 'patch'
    },

    resource() {
      const resource = this.getResource()
      return getMemberResource(this.itemId, resource) || resource
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

    dataPath() {
      return this.getDataPathFrom(this.dataComponent)
    },

    sourceData() {
      // Possible parents are DitoForm for forms, or DitoView for root lists.
      // Both have a data property which abstracts away loading and inheriting
      // of data.
      let { data } = this.parentRouteComponent
      if (data) {
        // Handle nested data by splitting the dataPath, iterate through the
        // actual data and look nest child-data up.
        const dataParts = parseDataPath(
          this.getDataPathFrom(this.parentRouteComponent)
        )
        // Compare dataParts against matched routePath parts, to identify those
        // parts that need to be treated like ids and mapped to indices in data.
        const pathParts = this.routeRecord.path.split('/')
        const routeParts = pathParts.slice(pathParts.length - dataParts.length)
        this.sourceKey = null
        const lastDataPart = dataParts[dataParts.length - 1]
        if (isObjectSource(this.sourceSchema) && lastDataPart === 'create') {
          // If we have an object source and are creating, the dataPath needs to
          // be shortened by the 'create' entry. This isn't needed for list
          // sources, as there the parameter is actually mapped to the item id.
          dataParts.length--
        }
        for (let i = 0, l = dataParts.length; i < l && data; i++) {
          const dataPart = dataParts[i]
          // If this is an :id part, find the index of the item with given id.
          const key = /^:id/.test(routeParts[i])
            ? dataPart === 'create'
              ? null // There's no index for entries about to be created
              : this.findItemIdIndex(this.sourceSchema, data, dataPart)
            : dataPart
          // Skip the final lookup but remember `sourceKey`, as we want the
          // parent data so we can replace the entry at `sourceKey` on it.
          if (i === l - 1) {
            this.sourceKey = key
          } else {
            data = data[key]
          }
        }
      }
      return data
    },

    inheritedData() {
      // Data inherited from parent, and cloned to protect against reactive
      // changes until changes are applied through setSourceData(), unless
      // `sourceSchema.mutate` is true, in which case data is mutated directly.
      if (
        this.isTransient &&
        this.clonedData === undefined &&
        this.sourceData &&
        this.sourceKey !== null
      ) {
        let data = this.sourceData[this.sourceKey]
        if (!this.doesMutate) {
          // Use a trick to store cloned inherited data in clonedData, to make
          // it reactive and prevent it from being cloned multiple times.
          this.clonedData = data = clone(data)
        }
        if (
          data === null &&
          !this.isCreating &&
          isObjectSource(this.sourceSchema)
        ) {
          // If data of an object source is null, redirect to its create route.
          this.$router.push({ path: 'create', append: true })
        }
        return data
      }
      return this.clonedData
    },

    // @override ResourceMixin.hasData()
    hasData() {
      return !!this.data
    },

    itemLabel() {
      return this.getItemLabel(this.sourceSchema, this.data, { extended: true })
    }
  },

  watch: {
    sourceData: 'clearClonedData',
    // Needed for the 'create' redirect in `inheritedData()` to work:
    create: 'setupData'
  },

  methods: {
    emitSchemaEvent(event, params) {
      return this.mainSchemaComponent.emitEvent(event, params)
    },

    getDataPathFrom(route) {
      // Get the data path by denormalizePath the relative route path
      return this.api.denormalizePath(this.path
        // DitoViews have nested routes, so don't remove their path.
        .slice((route.isView ? 0 : route.path.length) + 1))
    },

    // @override ResourceMixin.setupData()
    setupData() {
      if (this.isCreating) {
        this.createdData = this.createdData ||
          this.createData(this.schema, this.type)
      } else {
        this.ensureData()
      }
    },

    setSourceData(data) {
      if (this.sourceData && this.sourceKey !== null) {
        const { mainSchemaComponent } = this
        this.$set(
          this.sourceData,
          this.sourceKey,
          mainSchemaComponent.filterData(data)
        )
        mainSchemaComponent.onChange()
        return true
      }
      return false
    },

    addSourceData(data) {
      return isObjectSource(this.sourceSchema)
        ? this.setSourceData(data)
        : !!this.sourceData?.push(data)
    },

    // @override ResourceMixin.clearData()
    clearData() {
      this.setData(null)
    },

    // @override ResourceMixin.setData()
    setData(data) {
      // setData() is called after submit when data has changed.
      if (this.isTransient) {
        // For components with transient data, modify this.sourceData.
        this.setSourceData(data)
      } else {
        this.createdData = null
        this.loadedData = data
      }
    },

    clearClonedData(newValue, oldValue) {
      // Only clear if the watched sourceData itself changes in the form.
      if (newValue !== oldValue) {
        this.clonedData = undefined
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
        ? present ? 'create' : 'created'
        : present ? 'submit' : 'submitted'
    },

    async submit(button, { validate = true, closeForm = false } = {}) {
      if (validate && !this.validateAll()) {
        return false
      }

      const getVerb = present => this.verbs[this.getSubmitVerb(present)]

      // Allow buttons to override both method and resource path to submit to:
      const butttonResource = getResource(button.schema.resource, {
        parent: this.resource
      })
      const resource = butttonResource || this.resource
      const method = resource?.method || this.method
      const data = this.getPayloadData(button, method)
      let success
      if (!butttonResource && this.isTransient) {
        success = await this.submitTransient(button, resource, method, data, {
          onSuccess: () => this.emitSchemaEvent(this.getSubmitVerb()),
          onError: error => this.emitSchemaEvent('error', {
            context: { error }
          }),
          notifySuccess: () => {
            const verb = getVerb(false)
            this.notify({
              type: 'info',
              title: this.isCreating
                ? `Item ${capitalize(verb)}`
                : `Change ${capitalize(verb)}`,
              text: [
                this.isCreating
                  ? `${this.itemLabel} was ${verb}.`
                  : `Changes to ${this.itemLabel} were ${verb}.`,
                this.transientNote
              ]
            })
          },
          notifyError: () => {
            const verb = getVerb(true)
            this.notify({
              type: 'error',
              title: 'Request Error',
              text: `Unable to ${verb} ${this.itemLabel}.`
            })
          }
        })
      } else {
        success = await this.submitResource(button, resource, method, data, {
          setData: true,
          onSuccess: () => this.emitSchemaEvent(this.getSubmitVerb()),
          onError: error => this.emitSchemaEvent('error', {
            context: { error }
          }),
          notifySuccess: () => {
            const verb = getVerb(false)
            this.notify({
              type: 'success',
              title: `Successfully ${capitalize(verb)}`,
              text: `${this.itemLabel} was ${verb}.`
            })
          },
          notifyError: error => {
            const verb = getVerb(true)
            this.notify({
              type: 'error',
              title: 'Request Error',
              text: [
                `Unable to ${verb} ${this.itemLabel}${error ? ':' : ''}`,
                error?.message || error
              ]
            })
          }
        })
      }
      if (success) {
        this.resetValidation()
        if (closeForm || button.closeForm) {
          this.close()
        } else if (this.isCreating) {
          // Redirect to the form editing the newly created item:
          const id = this.getItemId(this.schema, this.data)
          this.$router.replace({ path: `../${id}`, append: true })
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
