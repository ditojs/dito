<template lang="pug">
  .dito-form(
    :class="formClass"
  )
    form(v-if="isActive" @submit.prevent="onSubmit()")
      dito-tabs(
        :tabs="tabs"
        :selectedTab="selectedTab"
      )
      .dito-scroll
        .dito-content
          dito-panel(
            v-for="(tabSchema, key) in tabs"
            v-show="selectedTab === key"
            :key="key"
            :tab="key"
            :schema="tabSchema"
            :dataPath="nestedDataPath"
            :data="data || {}"
            :meta="meta"
            :store="store"
            :disabled="loading"
          )
          dito-panel(
            :schema="schema"
            :dataPath="nestedDataPath"
            :data="data || {}"
            :meta="meta"
            :store="store"
            :disabled="loading"
          )
          .dito-buttons
            button.dito-button(
              type="button"
              @click.prevent="onCancel"
              :class="`dito-button-${verbCancel}`"
            ) {{ buttons.cancel && buttons.cancel.label }}
            button.dito-button(
              type="submit"
              :class="`dito-button-${verbSubmit}`"
            ) {{ buttons.submit && buttons.submit.label }}
            button.dito-button(
              v-for="(button, key) in buttons"
              v-if="key !== 'submit' && key !== 'cancel'"
              type="submit"
              @click.prevent="onSubmit(button)"
              :class="`dito-button-${key}`"
            ) {{ button.label }}
    router-view(v-else)
</template>

<style lang="sass">
.dito
  .dito-form
    &,
    form
      // To make vertical scrolling in .dito-scroll work
      flex: 1
      display: flex
      flex-flow: column
    .dito-content
      > .dito-buttons
        margin-top: $form-margin
        text-align: center
        font-size: $menu-font-size
        button
          border-radius: 2em
          padding: 0.3em 0.9em
</style>

<script>
import DitoComponent from '@/DitoComponent'
import DataMixin from '@/mixins/DataMixin'
import RouteMixin from '@/mixins/RouteMixin'
import {
  isArray, isObject, clone, capitalize, parseDataPath
} from '@ditojs/utils'

export default DitoComponent.component('dito-form', {
  mixins: [DataMixin, RouteMixin],

  data() {
    return {
      createdData: null,
      clonedData: undefined,
      isForm: true,
      components: {},
      formClass: null
    }
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
    listSchema() {
      return this.meta.listSchema
    },

    schema() {
      // Determine the current form schema through the listSchema, with multi
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

    isActive() {
      return this.isLastRoute || this.isLastUnnestedRoute
    },

    type() {
      return this.$route.query.type
    },

    create() {
      // this.param is inherited from RouteMixin
      return this.param === 'create'
    },

    itemId() {
      return this.create ? null : this.param
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
      return capitalize(this.create ? this.verbCreate : this.verbEdit)
    },

    buttons() {
      return this.schema?.buttons || {}
    },

    tabs() {
      return this.schema?.tabs
    },

    selectedTab() {
      const { hash } = this.$route
      return hash?.substring(1) || this.tabs && Object.keys(this.tabs)[0] || ''
    },

    data() {
      // Return different data "containers" based on different scenarios:
      // 1. createdData, if we're in a form for a newly created object.
      // 2. loadedData, if the form itself is the root of the data (e.g. when
      //    directly loading an editing root).
      // 3. The data inherited from the parent, which itself may be either a
      //    view that loaded the data, or a form that either loaded the data, or
      //    also inherited it from its parent. Note that we use a clone of it,
      //    so, data changes aren't applied until setListData() is called.
      return this.createdData || this.loadedData || this.inheritedData
    },

    dataPath() {
      // Get the data path by denormalizePath the relative route path
      const { parentRouteComponent: parent } = this
      return this.api.denormalizePath(this.path
        // DitoViews have nested routes, so don't remove their path.
        .substring((parent.isView ? 0 : parent.path.length) + 1))
    },

    nestedDataPath() {
      // Nested data needs to prefix its fields with the data path, for
      // validation errors to find their targets.
      return this.isNested ? this.dataPath : ''
    },

    listData() {
      // Possible parents are DitoForm for forms, or DitoView for root lists.
      // Both have a data property which abstracts away loading and inheriting
      // of data.
      let { data } = this.parentRouteComponent
      // Handle nested data by splitting the dataPath, iterate through the
      // actual data and look nest child-data up.
      const dataParts = this.dataPath.split('/')
      // Compare dataParts against matched routePath parts, to identify those
      // parts that need to be treated like ids and mapped to indices in data.
      const pathParts = this.routeRecord.path.split('/')
      const routeParts = pathParts.slice(pathParts.length - dataParts.length)
      // Use -1 for length to skip the final lookup, as we want the parent data.
      for (let i = 0, l = dataParts.length - 1; i < l && data; i++) {
        const dataPart = dataParts[i]
        // If this is an :id part, find the index of the item with given id.
        const key = /^:id/.test(routeParts[i])
          ? this.findItemIdIndex(data, dataPart)
          : dataPart
        data = data[key]
      }
      return data
    },

    listIndex() {
      // Find item by id in the parent list data.
      return this.findItemIdIndex(this.listData, this.itemId)
    },

    inheritedData() {
      // Data inherited from parent, and cloned to protect against reactive
      // changes until changes are applied through setListData()
      // Use a trick to store the cloned inherited data in clonedData, to make
      // it reactive as well and to make sure that we're not cloning twice.
      if (this.isTransient && this.clonedData === undefined && this.listData) {
        this.clonedData = this.listIndex >= 0
          ? clone(this.listData[this.listIndex])
          : null
      }
      return this.clonedData
    },

    shouldLoad() {
      // Only load data if this component is the last one in the route and we
      // can't inherit the data from the parent already, see data():
      return !this.isTransient && !this.data && !this.loading
    },

    isDirty() {
      return Object.keys(this.$fields).some(key => this.$fields[key].dirty)
    }
  },

  methods: {
    initData() { // overrides DataMixin.initData()
      if (this.create) {
        const { type } = this
        this.createdData = this.createdData ||
          this.createData(this.schema, { type })
      } else {
        // super.initData()
        DataMixin.methods.initData.call(this)
      }
    },

    setListData(data) {
      const { clonedData, listIndex } = this
      if (clonedData && listIndex >= 0) {
        this.$set(this.listData, listIndex, {
          ...clonedData,
          ...this.filterData(data)
        })
        return true
      }
      return false
    },

    filterData(data) {
      // Filters out arrays that aren't considered nested data, as those are
      // already taking care of themselves through their own end-points and
      // shouldn't be set.
      const copy = {}
      for (const [key, value] of Object.entries(data)) {
        if (isArray(value)) {
          const component = this.components[key]
          // Only check for isNested on list items that actually load data,
          // since other components can have array values too.
          if (component?.isList && !component.isNested) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    setData(data) {
      // setData() is called after submit when data has changed. Try to modify
      // this.listData first, for components with transient data.
      if (!this.setListData(data)) {
        this.loadedData = data
      }
    },

    addErrors(errors, focus) {
      for (const [dataPath, errs] of Object.entries(errors || {})) {
        const component = this.components[dataPath]
        if (component) {
          component.addErrors(errs, focus)
        } else {
          throw new Error(`Cannot add errors for field ${dataPath}: ${
            JSON.stringify(errors)}`)
        }
      }
    },

    focus(dataPath) {
      const component = this.components[dataPath]
      if (component) {
        component.focus()
      }
    },

    notifyValidationErrors() {
      this.notify('error', 'Validation Errors',
        'Please correct the highlighted errors.')
    },

    async onSubmit(button) {
      if (await this.$validator.validateAll()) {
        // Default button is submit:
        this.submit(button || this.buttons.submit)
      } else {
        this.focus(this.$errors.items[0].field)
        this.notifyValidationErrors()
      }
    },

    onCancel() {
      if (
        !this.isDirty ||
        confirm('You have unsaved changed. Do you really want to cancel?')
      ) {
        this.close(false)
      }
    },

    close(reload) {
      this.$router.push({ path: '..', append: true })
      // Tell the parent to reload its data if this was a submit()
      // See DataMixin.shouldReload:
      const parent = this.parentRouteComponent
      if (reload && !parent.isTransient) {
        parent.reload = true
      }
    },

    submit(button = {}) {
      const { onSuccess, onError } = button
      if (this.isTransient) {
        // We're dealing with a create form with nested forms, so have to deal
        // with transient objects. When editing nested transient, nothing needs
        // to be done as it just works, but when creating, we need to add to /
        // create the parent list.
        let ok = true
        if (this.create) {
          const { listData } = this
          if (listData) {
            listData.push(this.data)
          } else {
            ok = false
            this.notify('error', 'Request Error',
              `Unable to ${this.verbCreate} item.`)
          }
        } else {
          this.setListData(this.data)
          const label = this.getItemLabel(this.data)
          if (onSuccess) {
            onSuccess.call(this, this.data, label)
          } else {
            this.notify('info', 'Change Applied',
              `<p>Changes in ${label} were applied.</p>` +
              '<p><b>Note</b>: the parent still needs to be saved ' +
              'in order to persist this change.</p>')
          }
        }
        if (ok) {
          this.close(false)
        }
      } else {
        let { method, resource } = this
        // Allow buttons to override both method and resource path:
        method = button.method || method
        const { path } = button
        if (path) {
          resource = { ...resource, path }
        }
        const payload = this.processPayload(this.data)
        this.request(method, { payload, resource }, (err, response) => {
          // eslint-disable-next-line
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
              const label = payload ? this.getItemLabel(payload) : 'form'
              if (onError) {
                onError.call(this, error, payload, label)
              } else {
                this.notify('error', 'Request Error',
                  `Error submitting ${label}:\n${error.message || error}`)
              }
            }
          } else {
            const label = data ? this.getItemLabel(data) : 'form'
            if (onSuccess) {
              onSuccess.call(this, data, label)
            } else {
              const submitted = this.verbSubmitted
              this.notify('success', `Successfully ${capitalize(submitted)}`,
                `${label} was ${submitted}.`)
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

    showErrors(errors, focus) {
      let first = true
      for (const [key, errs] of Object.entries(errors)) {
        // Convert from JavaScript property access notation, to our own form
        // of relative JSON pointers as data-paths:
        const dataPath = parseDataPath(key).join('/')
        const component = this.components[dataPath]
        if (component) {
          component.addErrors(errs, first && focus)
        } else {
          // Couldn't find the component for the given dataPath. See if we have
          // a component serving a part of the dataPath, and take it from there:
          let found = false
          const parts = dataPath.split('/')
          while (!found && parts.length > 1) {
            parts.pop()
            const component = this.components[parts.join('/')]
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
