<template lang="pug">
  .dito-form
    form(v-if="isLastRoute" @submit.prevent="submit()")
      dito-tabs(
        :tabs="tabs"
        :selectedTab="selectedTab"
      )
      .dito-scroll
        .dito-content
          template(v-for="(tabSchema, key) in tabs")
            dito-panel(
              v-show="selectedTab === key"
              :schema="tabSchema"
              :name="key"
              :data="data || {}"
              :meta="meta"
              :store="store"
              :disabled="loading"
            )
          dito-panel(
            :schema="formSchema"
            :data="data || {}"
            :meta="meta"
            :store="store"
            :disabled="loading"
          )
          .dito-buttons
            button.dito-button.dito-button-cancel(
              type="button"
              @click.prevent="cancel"
            ) {{ buttons.cancel && buttons.cancel.label }}
            button.dito-button(
              type="submit"
              :class="`dito-button-${verbSubmit}`"
            ) {{ buttons.submit && buttons.submit.label }}
            button.dito-button(
              v-for="(button, key) in buttons"
              v-if="key !== 'submit' && key !== 'cancel'"
              type="submit"
              @click.prevent="submit(button)"
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
import TypeComponent from '@/TypeComponent'
import DataMixin from '@/mixins/DataMixin'
import RouteMixin from '@/mixins/RouteMixin'
import { isArray, isObject, clone, capitalize } from '@/utils'

export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin, DataMixin],

  data() {
    return {
      createdData: null,
      clonedData: undefined,
      parentIndex: null,
      isForm: true,
      components: {}
    }
  },

  created() {
    // Errors can get passed on throgh the meta object, so add them now.
    // See TypeMixin.showErrors()
    const { meta } = this
    const { errors } = meta
    if (errors) {
      delete meta.errors
      // Add the errors after initialzation of $validator
      this.$nextTick(() => {
        this.addErrors(errors, true)
      })
    }
  },

  computed: {
    name() {
      return this.formSchema.name
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

    buttons() {
      return this.formSchema.buttons || {}
    },

    tabs() {
      return this.formSchema.tabs
    },

    selectedTab() {
      const { hash } = this.$route
      return hash && hash.substring(1) ||
          this.tabs && Object.keys(this.tabs)[0] || ''
    },

    data() {
      // Return differnent data "containers" based on different scenarios:
      // 1. createdData, if we're in a form for a newly created object.
      // 2. loadedData, if the form itself is the root of the data (e.g. when
      //    directly loading an editing root).
      // 3. The data inherited from the parent, which itself may be either a
      //    view that loaded the data, or a form that either loaded the data, or
      //    also inherited it from its parent. Note that we use a clone of it,
      //    so, data changes aren't applied until setParentData() is called.
      return this.createdData || this.loadedData || this.inheritedData
    },

    parentList() {
      // Possible parents are DitoForm for nested forms, or DitoView for root
      // lists. Both have a data property which abstracts away loading and
      // inheriting of data.
      const parentData = this.parentRouteComponent.data
      return parentData && parentData[this.viewSchema.name]
    },

    inheritedData() {
      // Data inherited from parent, and cloned to protect against reactive
      // changes until changes are applied through setParentData()
      const { parentList } = this
      // Use a trick to store the cloned inherited data in clonedData, to make
      // it reactive as well as to make sure that we're not cloning twice.
      if (this.isTransient && this.clonedData === undefined && parentList) {
        // See if we can find item by id in the parent list.
        const parentIndex = this.parentIndex = parentList.findIndex(
          (item, index) => this.getItemId(item, index) === this.itemId
        )
        if (parentIndex >= 0) {
          this.clonedData = clone(parentList[parentIndex])
        }
      }
      return this.clonedData
    },

    shouldLoad() {
      // Only load data if this component is the last one in the route and we
      // can't inherit the data from the parent already, see data():
      return !this.isTransient && !this.data
    },

    isDirty() {
      return Object.keys(this.$fields).some(key => this.$fields[key].dirty)
    }
  },

  methods: {
    initData() { // overrides DataMixin.initData()
      const initData = (schema, data) => {
        // Sets up an createdData object that has keys with null-values for all
        // form fields, so they can be correctly watched for changes.
        for (const key in schema.tabs) {
          initData(schema.tabs[key], data)
        }
        for (const [key, compSchema] of Object.entries(schema.components)) {
          const comp = TypeComponent.get(compSchema.type)
          const defaultValue = comp && comp.options.methods.defaultValue
          data[key] = defaultValue ? defaultValue() : null
        }
        return data
      }

      if (this.create) {
        if (!this.createdData) {
          this.createdData = initData(this.formSchema, {})
        }
      } else {
        // super.initData()
        DataMixin.methods.initData.call(this)
      }
    },

    setParentData(data) {
      const { clonedData, parentIndex } = this
      if (clonedData && parentIndex >= 0) {
        this.$set(this.parentList, parentIndex,
          { ...clonedData, ...this.filterData(data) })
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
          const comp = this.components[key]
          // Only check for nested on list items that actuall load data, since
          // other components can have array values too.
          if (comp && comp.isList && !comp.viewSchema.nested) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    setData(data) {
      // setData() is called after submit when data has changed. Try to modify
      // this.parentList first, for components with transient data.
      if (!this.setParentData(data)) {
        this.loadedData = data
      }
    },

    addErrors(errors, focus) {
      for (const [name, errs] of Object.entries(errors || {})) {
        const component = this.components[name]
        if (component) {
          component.addErrors(errs, focus)
        } else {
          throw new Error(`Cannot add errors for field ${name}: ${errors}`)
        }
      }
    },

    focus(name) {
      const component = this.components[name]
      if (component) {
        component.focus()
      }
    },

    goBack(reload, checkDirty) {
      if (!checkDirty || (!this.isDirty || confirm(
        'You have unsaved changed. Do you really want to go back?'))
      ) {
        this.$router.push({ path: '..', append: true })
        // Tell the parent to reload its data if this was a submit()
        // See DataMixin.shouldReload:
        const parent = this.parentRouteComponent
        if (reload && !parent.isTransient) {
          parent.reload = true
        }
      }
    },

    notifyValidationErrors() {
      this.notify('error', 'Validation Errors',
        'Please correct the highligted errors.')
    },

    async submit(button) {
      if (await this.$validator.validateAll()) {
        // Default button is submit:
        this.submitData(button || this.buttons.submit)
      } else {
        this.focus(this.$errors.items[0].field)
        this.notifyValidationErrors()
      }
    },

    submitData(button = {}) {
      const payload = this.data
      const { onSuccess, onError } = button
      if (this.isTransient) {
        // We're dealing with a create form with nested forms, so have to deal
        // with transient objects. When editing nested transient, nothing needs
        // to be done as it just works, but when creating, we need to add to /
        // create the parent list.
        let ok = true
        if (this.create) {
          const { parentList } = this
          if (parentList) {
            parentList.push(payload)
          } else {
            ok = false
            this.notify('error', 'Request Error',
              `Unable to ${this.verbCreate} item.`)
          }
        } else {
          this.setParentData(payload)
          const title = this.getItemTitle(this.data)
          if (onSuccess) {
            onSuccess.call(this, this.data, title)
          } else {
            this.notify('info', 'Change Applied',
              `Changes in ${title} were applied.\n` +
              `NOTE: The parent needs to be ${this.verbSaved} ` +
              `to persist this change.`
            )
          }
        }
        if (ok) {
          this.goBack(false, false)
        }
      } else {
        let { method, resource } = this
        // Allow buttons to override both method and resource path:
        method = button.method || method
        const { path } = button
        if (path) {
          resource = { ...resource, path }
        }
        this.request(method, { payload, resource }, (err, response) => {
          const { data = {} } = response
          if (!err) {
            const title = this.getItemTitle(data)
            if (onSuccess) {
              onSuccess.call(this, data, title)
            } else {
              const submitted = this.verbSubmitted
              this.notify('success', `Sucessfully ${capitalize(submitted)}`,
                `${title} was ${submitted}.`)
            }
            // After submitting, navigate back to the parent form or view,
            // except if a button turns it off:
            if (button.back === false) {
              if (data) {
                this.setData(data)
              }
            } else {
              this.goBack(true, false)
            }
          } else {
            // Dito validation error?
            const { errors } = this.hasValidationError(response) && data || {}
            let error = null
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
              const title = this.getItemTitle(this.data)
              if (onError) {
                onError.call(this, error, this.data, title)
              } else {
                this.notify('error', 'Request Error',
                  `Error storing ${title}: ${error.message || error}`)
              }
            }
          }
        })
      }
    },

    showErrors(errors, focus) {
      let hasErrors = false
      for (const [key, errs] of Object.entries(errors)) {
        const path = key.split('/')
        const field = path[0]
        const component = this.components[field]
        if (component) {
          component.showErrors(path, errs, !hasErrors && focus)
        } else {
          throw new Error(
            `Cannot find component for field ${field}, errors: ${errs}`)
        }
        hasErrors = true
      }
      return hasErrors
    },

    cancel() {
      this.goBack(false, true)
    }
  }
})
</script>
