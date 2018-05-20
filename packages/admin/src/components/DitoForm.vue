<template lang="pug">
  // If form is not active, render router-view to nest further route components
  router-view(v-if="!isActive")
  form.dito-form.dito-scroll-parent(
    v-else
    :class="formClass"
    @submit.prevent="onSubmit(buttons.submit)"
  )
    // .debug
      div Created {{ `${createdData}` }}
      div Inherited {{ `${inheritedData}` }}
      div Loaded {{ `${loadedData}` }}
    dito-schema(
      :schema="schema"
      :dataPath="dataPath"
      :data="data || {}"
      :meta="meta"
      :store="store"
      :disabled="loading"
    )
      .dito-buttons.dito-buttons-form(slot="buttons")
        // Render cancel button
        button.dito-button(
          v-if="shouldRender(buttons.cancel)"
          type="button"
          @click="onCancel"
          :class="`dito-button-${verbs.cancel}`"
        ) {{ buttons.cancel.label }}
        // Render submit button
        button.dito-button(
          v-if="shouldRender(buttons.submit) && !doesMutate"
          type="submit"
          :class="`dito-button-${verbs.submit}`"
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
            :class="`dito-button-${button.name}`"
          ) {{ getLabel(button) }}
          button.dito-button(
            v-else
            type="submit"
            @click.prevent="onSubmit(button)"
            :class="`dito-button-${button.name}`"
          ) {{ getLabel(button) }}
</template>

<script>
import DitoComponent from '@/DitoComponent'
import DataMixin from '@/mixins/DataMixin'
import RouteMixin from '@/mixins/RouteMixin'
import { isObjectSource } from '@/schema'
import {
  isArray, isObject, clone, capitalize, parseDataPath, deepMerge
} from '@ditojs/utils'

export default DitoComponent.component('dito-form', {
  mixins: [DataMixin, RouteMixin],

  data() {
    return {
      createdData: null,
      clonedData: undefined,
      sourceKey: null,
      isForm: true,
      loadCache: {}, // See TypeMixin.load()
      formClass: null,
      temporaryId: 0
    }
  },

  watch: {
    sourceData: 'clearClonedData',
    // Needed for the 'create' redirect in `inheritedData()` to work:
    create: 'initData'
  },

  created() {
    // Errors can get passed on through the meta object, so add them now.
    // See TypeMixin.showErrors()
    const { meta } = this
    const { errors } = meta
    if (errors) {
      delete meta.errors
      // Add the errors after initialization of $validator
      this.$nextTick(() => {
        this.addErrors(errors, true)
      })
    }
  },

  computed: {
    schema() {
      // Determine the current form schema through the sourceSchema, with multi-
      // form schema support.
      let form = this.getFormSchema(this.data)
      if (!form) {
        // If the right form couldn't be determined from the data, see if
        // there's a query parameter defining it (see `this.type`).
        const { type } = this
        form = type && this.getFormSchema({ type })
      }
      return form
    },

    sourceSchema() {
      return this.meta.schema
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
        deepMerge(
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

    clipboardData() {
      return this.processData({
        removeIds: true
      })
    },

    shouldLoad() {
      // Only load data if this component is the last one in the route and we
      // can't inherit the data from the parent already, see computed data():
      return !this.isTransient && !this.data && !this.loading
    },

    isDirty() {
      for (const form of [this, ...this.nestedFormComponents]) {
        if (!form.doesMutate && Object.keys(form.$fields).some(
          key => form.$fields[key].dirty)
        ) {
          return true
        }
      }
      return false
    }
  },

  methods: {
    getDataPathFrom(route) {
      // Get the data path by denormalizePath the relative route path
      return this.api.denormalizePath(this.path
        // DitoViews have nested routes, so don't remove their path.
        .substring((route.isView ? 0 : route.path.length) + 1))
    },

    getComponent(dataPathOrKey) {
      if (isArray(dataPathOrKey)) {
        dataPathOrKey = dataPathOrKey.join('/')
      }
      // See if the argument starts with this form's dataPath. If not,
      // then it's a key and needs to be prepended with the full path:
      const dataPath = !dataPathOrKey.startsWith(this.dataPath)
        ? this.appendDataPath(this.dataPath, dataPathOrKey)
        : dataPathOrKey
      return this.components[dataPath] || null
    },

    // @override DataMixin.initData()
    initData() {
      if (this.create) {
        this.createdData = this.createdData ||
          this.createData(this.schema, this.type)
      } else {
        // super.initData()
        DataMixin.methods.initData.call(this)
      }
    },

    setSourceData(data) {
      if (this.sourceData && this.sourceKey !== null) {
        this.$set(this.sourceData, this.sourceKey, this.filterData(data))
        return true
      }
      return false
    },

    addSourceData(data) {
      return isObjectSource(this.sourceSchema)
        ? this.setSourceData(data)
        : this.sourceData?.push(data) || false
    },

    filterData(data) {
      // Filters out arrays that aren't considered nested data, as those are
      // already taking care of themselves through their own end-points and
      // shouldn't be set.
      const copy = {}
      for (const [key, value] of Object.entries(data)) {
        if (isArray(value)) {
          const component = this.getComponent(key)
          // Only check for isNested on source items that actually load data,
          // since other components can have array values too.
          if (component && component.isSource && !component.isNested) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    setData(data) {
      // setData() is called after submit when data has changed.
      if (this.isTransient) {
        // For components with transient data, modify this.sourceData.
        this.setSourceData(data)
      } else {
        this.loadedData = data
      }
    },

    clearClonedData(newValue, oldValue) {
      // Only clear if the watched sourceData itself changes in the form.
      if (newValue !== oldValue) {
        this.clonedData = undefined
      }
    },

    addErrors(errors, focus) {
      for (const [dataPath, errs] of Object.entries(errors || {})) {
        const component = this.getComponent(dataPath)
        if (component) {
          component.addErrors(errs, focus)
        } else {
          throw new Error(`Cannot add errors for field ${dataPath}: ${
            JSON.stringify(errors)}`)
        }
      }
    },

    focus(dataPath) {
      this.getComponent(dataPath)?.focus()
    },

    notifyValidationErrors() {
      this.notify('error', 'Validation Errors',
        'Please correct the highlighted errors.')
    },

    isDefaultButton(button) {
      return ['submit', 'cancel'].includes(button.name)
    },

    async onSubmit(button) {
      if (await this.$validator.validateAll()) {
        this.submit(button)
      } else {
        this.focus(this.$errors.items[0].field)
        this.notifyValidationErrors()
      }
    },

    onClick(button) {
      return button.onClick.call(this, this.data, button)
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
      const itemLabel = this.data ? this.getItemLabel(this.data) : 'form'
      const payload = this.isDefaultButton(button) && this.processData({
        processIds: true
      })
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
            onSuccess.call(this, payload, itemLabel)
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
        // Allow buttons to override both method (verb) and resource path:
        const method = button.method || button.verb || this.method
        const resource = button.path
          ? {
            ...this.resource,
            path: button.path
          }
          : this.resource
        this.request(method, { payload, resource }, (err, response) => {
          const data = response?.data
          if (err) {
            // See if we're dealing with a Dito validation error:
            let error = null
            const errors = this.hasValidationError(response) && data.errors
            if (errors) {
              try {
                if (this.showErrors(errors, true)) {
                  this.notifyValidationErrors()
                }
              } catch (err) {
                error = err
              }
            } else {
              error = isObject(data) ? data : err
            }
            if (error) {
              if (onError) {
                onError.call(this, error, itemLabel)
              } else {
                this.notify('error', 'Request Error',
                  `Error submitting ${itemLabel}:\n${error.message || error}`)
              }
            }
          } else {
            if (onSuccess) {
              onSuccess.call(this, payload, itemLabel)
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
    },

    setTemporaryId(data) {
      // Temporary ids are marked with a '@' at the beginning.
      data.id = `@${++this.temporaryId}`
    },

    hasTemporaryId(data) {
      return /^@/.test(data?.id)
    },

    isReference(data) {
      // Returns true if value is an object that holds nothing more than an id.
      const keys = data && Object.keys(data)
      return keys?.length === 1 && keys[0] === 'id'
    },

    processData(options = {}) {
      const {
        processIds = false,
        removeIds = false
      } = options
      // @ditojs/server specific handling of relates within graphs:
      // Find entries with temporary ids, and convert them to #id / #ref pairs.
      // Also handle items with relate and convert them to only contain ids.
      const process = (data, dataPath = '') => {
        // First, see if there's an associated component requiring processing.
        // See TypeMixin.processValue(), OptionsMixin.processValue():
        const component = this.getComponent(dataPath)
        if (component) {
          data = component.processValue(data, dataPath)
        }
        // Special handling is required for temporary ids when procssing non
        // transient data: Replace id with #id, so '#ref' can be used for
        // relates, see OptionsMixin:
        if (!this.isTransient && processIds && this.hasTemporaryId(data)) {
          const { id, ...rest } = data
          // A refeference is a shallow copy that hold nothing more than ids.
          // Use #ref instead of #id for these:
          data = this.isReference(data)
            ? { '#ref': id }
            : { '#id': id, ...rest }
        }
        if (isObject(data) || isArray(data)) {
          // Use reduce() for both arrays and objects thanks to Object.entries()
          data = Object.entries(data).reduce(
            (processed, [key, entry]) => {
              const value = process(entry, this.appendDataPath(dataPath, key))
              if (value !== undefined) {
                processed[key] = value
              }
              return processed
            },
            isArray(data) ? [] : {}
          )
        }
        if (removeIds && data?.id) {
          delete data.id
        }
        return data
      }

      return process(this.data, this.dataPath)
    },

    showErrors(errors, focus) {
      let first = true
      for (const [dataPath, errs] of Object.entries(errors)) {
        // Convert from JavaScript property access notation, to our own form
        // of relative JSON pointers as data-paths:
        const dataPathParts = parseDataPath(dataPath)
        const component = this.getComponent(dataPathParts)
        if (component?.formComponent?.isActive) {
          component.addErrors(errs, first && focus)
        } else {
          // Couldn't find a component in an active form for the given dataPath.
          // See if we have a component serving a part of the dataPath, and take
          // it from there:
          let found = false
          while (!found && dataPathParts.length > 1) {
            // Keep removing the last part until we find a match.
            dataPathParts.pop()
            const component = this.getComponent(dataPathParts)
            if (component) {
              component.navigateToErrors(dataPath, errs)
              found = true
            }
          }
          if (!found) {
            throw new Error(
              `Cannot find component for field ${dataPath}, errors: ${
                JSON.stringify(errs)}`)
          }
        }
        first = false
      }
      return !first
    }
  }
})
</script>
