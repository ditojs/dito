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
    dito-schema(
      ref="schema"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="store"
      :disabled="isLoading"
      :selectedTab="selectedTab"
      :menuHeader="true"
    )
      dito-buttons.dito-form-buttons.dito-buttons-large(
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
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'
import ResourceMixin from '@/mixins/ResourceMixin'
import { hasResource, getResource, getMemberResource } from '@/utils/resource'
import { getButtonSchemas, isObjectSource } from '@/utils/schema'
import {
  isObject, clone, capitalize, parseDataPath, merge
} from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin, ResourceMixin],

  data() {
    return {
      createdData: null,
      clonedData: undefined,
      sourceKey: null,
      isMounted: false,
      isForm: true
    }
  },

  computed: {
    verbs() {
      // Add submit / submitted to the verbs returned by ResourceMixin
      // NOTE: These get passed on to children through:
      // `provide() ... { $verbs: () => this.verbs }` in ResourceMixin
      const verbs = this.getVerbs()
      const { isCreating, hasResource } = this
      return {
        ...verbs,
        submit: isCreating ? verbs.create : verbs.save,
        submitted: isCreating ? verbs.created : verbs.saved,
        cancel: hasResource ? verbs.cancel : verbs.close,
        cancelled: hasResource ? verbs.cancelled : verbs.closed
      }
    },

    schema() {
      return this.getItemFormSchema(
        this.sourceSchema,
        // If there is no data yet, provide an empty object with just the right
        // type set, so the form can always be determined.
        this.data || { type: this.type }
      ) || {} // Always return a schema object so we don't need to check for it.
    },

    formSchemaComponent() {
      // Name this `formSchemaComponent` instead of `schemaComponent` to not
      // clash with DitoMixin.schemaComponent, which returns the schema in which
      // this component is contained (needed for nested forms).
      // Use the `isMounted` trick to make `$refs` somewhat reactive.
      return this.isMounted && this.$refs.schema
    },

    errors() {
      return this.formSchemaComponent?.errors
    },

    buttonSchemas() {
      return getButtonSchemas(
        merge(
          {
            cancel: {
              type: 'button',
              events: {
                click: () => {
                  this.cancel()
                }
              }
            },
            submit: !this.doesMutate && {
              type: 'submit',
              events: {
                click: ({ target }) => {
                  target.submit({ close: true })
                }
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
      return !this.hasResource
    },

    isCreating() {
      // this.param is inherited from RouteMixin
      return this.param === 'create'
    },

    isTouched() {
      return this.formSchemaComponent.isTouched
    },

    isDirty() {
      return this.formSchemaComponent.isDirty
    },

    isValid() {
      return this.formSchemaComponent.isValid
    },

    selectedTab() {
      return this.formSchemaComponent.selectedTab
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
      return this.getDataPathFrom(this.resourceComponent)
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
      return this.getItemLabel(this.sourceSchema, this.data, null, true)
    }
  },

  watch: {
    sourceData: 'clearClonedData',
    // Needed for the 'create' redirect in `inheritedData()` to work:
    create: 'setupData'
  },

  mounted() {
    this.isMounted = true
    // Errors can get passed on through the meta object, so add them now.
    // See DitoSchema.showValidationErrors() / SourceMixin.navigateToComponent()
    const { errors } = this.meta
    if (errors) {
      delete this.meta.errors
      this.showValidationErrors(errors, true)
    }
    // Handle button clicks and see if the buttons define a resource to submit
    // to, and if so, delegate to `submit()`:
    this.formSchemaComponent.on('click', ({ target }) => {
      if (
        target.type === 'button' &&
        hasResource(target.schema.resource) &&
        !target.responds('click')
      ) {
        target.submit({ close: false })
      }
    })
  },

  beforeRouteUpdate(to, from, next) {
    this.checkValidations(to, from, next)
  },

  beforeRouteLeave(to, from, next) {
    this.checkValidations(to, from, next)
  },

  methods: {
    checkValidations(to, from, next) {
      next(
        !this.isActive ||
        !this.doesMutate ||
        this.formSchemaComponent.validateAll()
      )
    },

    getDataPathFrom(route) {
      // Get the data path by denormalizePath the relative route path
      return this.api.denormalizePath(this.path
        // DitoViews have nested routes, so don't remove their path.
        .substring((route.isView ? 0 : route.path.length) + 1))
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
        this.$set(
          this.sourceData,
          this.sourceKey,
          this.formSchemaComponent.filterData(data)
        )
        this.formSchemaComponent.onChange()
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
      this.setData(null, true)
    },

    // @override ResourceMixin.setData()
    setData(data, clear = false) {
      // setData() is called after submit when data has changed.
      if (this.isTransient) {
        // For components with transient data, modify this.sourceData.
        this.setSourceData(data)
      } else {
        this.createdData = null
        this.loadedData = data
      }
      if (!clear) {
        this.formSchemaComponent.onLoad()
      }
    },

    clearClonedData(newValue, oldValue) {
      // Only clear if the watched sourceData itself changes in the form.
      if (newValue !== oldValue) {
        this.clonedData = undefined
      }
    },

    showValidationErrors(errors, focus) {
      this.formSchemaComponent.showValidationErrors(errors, focus)
    },

    cancel() {
      if (
        this.doesMutate ||
        !this.isDirty ||
        window.confirm(`You have unsaved changes. Do you really want to ${
          this.verbs.cancel
        }?`)
      ) {
        this.close()
      }
    },

    async close() {
      return new Promise(resolve => {
        this.$router.push(
          { path: this.parentRouteComponent.path },
          () => resolve(true),
          () => resolve(false)
        )
      })
    },

    async submit(button, { close = false } = {}) {
      if (!this.formSchemaComponent.validateAll()) {
        return false
      }

      const getVerb = present => {
        const verb = this.isCreating
          ? present ? 'create' : 'created'
          : present ? 'submit' : 'submitted'
        return this.verbs[verb]
      }

      // Allow buttons to override both method and resource path to submit to:
      const butttonResource = getResource(button.schema.resource, {
        parent: this.resource
      })
      const resource = butttonResource || this.resource
      const method = resource?.method || this.method
      // Convention: only post and patch requests pass the data as payload.
      const data = (
        ['post', 'patch'].includes(method) &&
        this.formSchemaComponent.processData({ processIds: true })
      )
      let changed
      if (!butttonResource && this.isTransient) {
        // Handle the default "submitting" of transient, nested data:
        changed = this.isCreating
          ? this.addSourceData(data)
          : this.setSourceData(data)
        if (changed) {
          const verb = getVerb(false)
          await this.emitButtonEvent(button, 'success', {
            notify: () => this.notify(
              'info',
              this.isCreating
                ? `Item ${capitalize(verb)}`
                : `Change ${capitalize(verb)}`,
              this.isCreating
                ? `${this.itemLabel} was ${verb}.`
                : `Changes to ${this.itemLabel} were ${verb}.`,
              this.transientNote
            )
          })
        } else {
          const verb = getVerb(true)
          const error = `Unable to ${verb} ${this.itemLabel}.`
          await this.emitButtonEvent(button, 'error', {
            error,
            notify: () => this.notify('error', 'Request Error', error)
          })
        }
      } else {
        changed = await new Promise(resolve => {
          this.request(
            method,
            { data, resource },
            async (err, { request, response }) => {
              const data = response?.data
              if (err) {
                // See if we're dealing with a Dito validation error:
                const errors = this.isValidationError(response) && data.errors
                if (errors) {
                  this.showValidationErrors(errors, true)
                } else {
                  const error = isObject(data) ? data : err
                  const verb = getVerb(true)
                  await this.emitButtonEvent(button, 'error', {
                    request,
                    response,
                    error,
                    notify: () => this.notify(
                      'error',
                      'Request Error',
                      `Unable to ${verb} ${this.itemLabel}${error ? ':' : ''}`,
                      error?.message || error
                    )
                  })
                }
                resolve(false)
              } else {
                // Update the underlying data before calling `notify()` or
                // `this.itemLabel`, so id is set after creating new items.
                if (data) {
                  this.setData(data)
                }
                const verb = getVerb(false)
                await this.emitButtonEvent(button, 'success', {
                  request,
                  response,
                  notify: () => this.notify(
                    'success',
                    `Successfully ${capitalize(verb)}`,
                    `${this.itemLabel} was ${verb}.`
                  )
                })
                resolve(true)
              }
            }
          )
        })
      }
      if (changed) {
        this.formSchemaComponent.resetValidation()
        if (close) {
          // TODO: Consider await this.close()?
          this.close()
        } else if (this.isCreating) {
          // Redirect to the form editing the newly created item:
          const id = this.getItemId(this.schema, this.data)
          this.$router.replace({ path: `../${id}`, append: true })
        }
      }
      return changed
    },

    async emitButtonEvent(button, event, { notify, request, response, error }) {
      // Compare notification-count before/after the event to determine if a
      // notification was already displayed, or if notify() should be called.
      const count = this.countNotifications()
      if (
        (await button.emitEvent(event, {
          params: {
            data: this.data,
            itemLabel: this.itemLabel,
            request,
            response,
            error
          }
        })) === undefined &&
        notify &&
        !this.countNotifications(count)
      ) {
        notify()
      }
    }
  }
})
</script>
