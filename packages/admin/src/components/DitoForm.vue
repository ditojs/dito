<template lang="pug">
.dito-form.dito-parent(
  :class="formClass"
)
  // NOTE: Nested form components are kept alive by using `v-show` instead of
  // `v-if` here, so event handling and other things stil work with nested
  // editing.
  router-view(
    v-if="!(isNestedRoute || isLastUnnestedRoute)"
    v-show="!isActive"
  )
  component.dito-scroll(
    v-show="isActive"
    :is="formTag"
    @submit.prevent="onSubmit(buttons.submit)"
  )
    dito-schema(
      ref="schema"
      :schema="schema"
      :dataPath="dataPath"
      :key="dataPath"
      :data="data || {}"
      :meta="meta"
      :store="store"
      :disabled="isLoading"
      :menuHeader="true"
    )
      .dito-buttons.dito-form-buttons(
        slot="buttons"
      )
        // Render cancel button
        button.dito-button(
          v-if="shouldRender(buttons.cancel)"
          type="button"
          @click="onCancel"
          v-bind="getButtonAttributes(verbs.cancel, buttons.cancel)"
        ) {{ buttons.cancel.label }}
        // Render submit button
        button.dito-button(
          v-if="shouldRender(buttons.submit) && !doesMutate"
          type="submit"
          v-bind="getButtonAttributes(verbs.submit, buttons.submit)"
        ) {{ buttons.submit.label }}
        // Render all other buttons
        template(
          v-for="button in buttons"
          v-if="!isDefaultButton(button) && shouldRender(button)"
        )
          // Distinguish between buttons thata fire onClick events and those
          // that submit the form.
          button.dito-button(
            v-if="button.onClick"
            type="button"
            @click="onClick(button)"
            v-bind="getButtonAttributes(button.name, button)"
          ) {{ getLabel(button) }}
          button.dito-button(
            v-else
            type="submit"
            @click.prevent="onSubmit(button)"
            v-bind="getButtonAttributes(button.name, button)"
          ) {{ getLabel(button) }}
</template>

<style lang="sass">
  .dito-form
    padding-top: $content-padding-half
</style>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'
import DataMixin from '@/mixins/DataMixin'
import ValidatorMixin from '@/mixins/ValidatorMixin'
import { isObjectSource } from '@/utils/schema'
import { getItemParams } from '@/utils/item'
import {
  isObject, clone, capitalize, parseDataPath, merge
} from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin, DataMixin, ValidatorMixin],
  inject: ['$validator'],

  data() {
    return {
      createdData: null,
      clonedData: undefined,
      sourceKey: null,
      isForm: true,
      formTag: 'form',
      formClass: null
    }
  },

  computed: {
    verbs() {
      // Add submit / submitted to the verbs returned by DataMixin
      const verbs = this.getVerbs()
      return {
        ...verbs,
        submit: this.create ? verbs.create : verbs.save,
        submitted: this.create ? verbs.created : verbs.saved
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

    isActive() {
      return this.isLastRoute || this.isLastUnnestedRoute
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

    create() {
      // this.param is inherited from RouteMixin
      return this.param === 'create'
    },

    itemId() {
      return this.create ? null : this.param ?? null
    },

    method() {
      return this.create ? 'post' : 'patch'
    },

    resource() {
      return {
        type: this.create ? 'collection' : 'member',
        id: this.itemId
      }
    },

    breadcrumbPrefix() {
      return capitalize(this.create ? this.verbs.create : this.verbs.edit)
    },

    buttons() {
      return this.getNamedSchemas(
        merge(
          {
            cancel: {},
            submit: {}
          },
          this.schema.buttons
        )
      )
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
      return this.createdData || this.loadedData || this.inheritedData
    },

    dataPath() {
      return this.getDataPathFrom(this.dataRouteComponent)
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
              : this.findItemIdIndex(data, dataPart)
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
          !this.create &&
          isObjectSource(this.sourceSchema)
        ) {
          // If data of an object source is null, redirect to its create route.
          this.$router.push({ path: 'create', append: true })
        }
        return data
      }
      return this.clonedData
    },

    isDirty() {
      // TODO: Consider adding isDirty() to TypeMixin for each component and
      // DitoSchema, for easer version of this, without nestedFormComponents.
      for (const form of [this, ...this.nestedFormComponents]) {
        if (!form.doesMutate && form.isDirty) {
          return true
        }
      }
      return false
    }
  },

  watch: {
    sourceData: 'clearClonedData',
    // Needed for the 'create' redirect in `inheritedData()` to work:
    create: 'setupData'
  },

  mounted() {
    // Errors can get passed on through the meta object, so add them now.
    // See DitoSchema.showErrors() / SourceMixin.navigateToComponent()
    const { errors } = this.meta
    if (errors) {
      delete this.meta.errors
      this.showErrors(errors, true)
    }
  },

  methods: {
    getDataPathFrom(route) {
      // Get the data path by denormalizePath the relative route path
      return this.api.denormalizePath(this.path
        // DitoViews have nested routes, so don't remove their path.
        .substring((route.isView ? 0 : route.path.length) + 1))
    },

    // @override DataMixin.setupData()
    setupData() {
      if (this.create) {
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
          this.$refs.schema.filterData(data)
        )
        this.$refs.schema.onChange()
        return true
      }
      return false
    },

    addSourceData(data) {
      return isObjectSource(this.sourceSchema)
        ? this.setSourceData(data)
        : !!this.sourceData?.push(data)
    },

    setData(data) {
      // setData() is called after submit when data has changed.
      if (this.isTransient) {
        // For components with transient data, modify this.sourceData.
        this.setSourceData(data)
      } else {
        this.loadedData = data
      }
      this.$refs.schema.onLoad()
    },

    clearClonedData(newValue, oldValue) {
      // Only clear if the watched sourceData itself changes in the form.
      if (newValue !== oldValue) {
        this.clonedData = undefined
      }
    },

    showErrors(errors, focus) {
      this.$refs.schema.showErrors(errors, focus)
    },

    isDefaultButton(button) {
      return ['submit', 'cancel'].includes(button.name)
    },

    async onSubmit(button) {
      this.clearErrors()
      if (await this.validateAll()) {
        this.submit(button)
      } else {
        // Focus first error field
        const errors = this.getErrors()
        // TODO: Move to DitoSchema instead?
        this.$refs.schema.focus(Object.keys(errors)[0], true)
      }
    },

    onClick(button) {
      return button.onClick.call(this, getItemParams(this))
    },

    onCancel() {
      if (!this.isDirty || confirm(
        `You have unsaved changed. Do you really want to ${this.verbs.cancel}?`
      )) {
        this.close(false)
      }
    },

    close(reload) {
      const parent = this.parentRouteComponent
      this.$router.push({ path: parent.path })
      // Tell the parent to reload its data if this was a submit()
      // See DataMixin.shouldReload:
      if (reload && !parent.isTransient) {
        parent.reload = true
      }
    },

    submit(button) {
      const { onSuccess, onError } = button
      // Allow buttons to override both method (verb) and resource path:
      const method = button.method || button.verb || this.method
      const resource = button.path
        ? {
          ...this.resource,
          path: button.path
        }
        : this.resource
      const itemLabel = this.data
        ? this.getItemLabel(this.sourceSchema, this.data, null, true)
        : 'form'
      // Convention: only post and patch requests pass the data as payload.
      const payload = ['post', 'patch'].includes(method) &&
        this.$refs.schema.processData({ processIds: true })
      if (payload && this.isTransient) {
        // We're dealing with a create form with nested forms, so have to deal
        // with transient objects. When editing nested transient, nothing needs
        // to be done as it just works, but when creating, we need to add to /
        // create the parent list.
        let ok = true
        if (this.create) {
          ok = this.addSourceData(payload)
          if (!ok) {
            this.notify('error', 'Request Error',
              `Unable to ${this.verbs.create} item.`)
          }
        } else if (!this.doesMutate) {
          this.setSourceData(payload)
          if (onSuccess) {
            onSuccess.call(this, getItemParams(this, {
              item: payload,
              itemLabel
            }))
          } else {
            this.notify('info', 'Change Applied',
              `<p>Changes in ${itemLabel} were applied.</p>` +
              '<p><b>Note</b>: the parent still needs to be saved ' +
              'in order to persist this change.</p>')
          }
        }
        if (ok) {
          this.close(false)
        }
      } else {
        this.request(method, { payload, resource }, (err, response) => {
          const data = response?.data
          if (err) {
            // See if we're dealing with a Dito validation error:
            const errors = this.isValidationError(response) && data.errors
            if (errors) {
              this.showErrors(errors, true)
            } else {
              const error = isObject(data) ? data : err
              if (error) {
                if (onError) {
                  onError.call(this, getItemParams(this, {
                    item: payload,
                    error,
                    itemLabel
                  }))
                } else {
                  this.notify('error', 'Request Error',
                    `Error submitting ${itemLabel}:\n${error.message || error}`)
                }
              }
            }
          } else {
            if (onSuccess) {
              onSuccess.call(this, getItemParams(this, {
                item: payload,
                itemLabel
              }))
            } else {
              const submitted = this.verbs.submitted
              this.notify('success', `Successfully ${capitalize(submitted)}`,
                `${itemLabel} was ${submitted}.`)
            }
            // After submitting, navigate back to the parent form or view,
            // except if a button turns it off:
            if (button.back === false) {
              if (data) {
                this.setData(data)
              }
            } else {
              this.close(true)
            }
          }
          return true // Errors were already handled.
        })
      }
    }
  }
})
</script>
