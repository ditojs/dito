<template lang="pug">
  .dito-form
    form(v-show="isLastRoute", @submit.prevent="submit")
      .dito-debug API endpoint: {{ endpoint }}
      dito-errors(
        v-if="errors.has('dito-data')",
        name="dito-data"
      )
      dito-tabs(
        :tabs="tabs",
        :selectedTab="selectedTab"
      )
      .dito-scroll
        .dito-content
          template(v-for="(tabDesc, key) in tabs")
            dito-panel(
              v-show="selectedTab === key",
              :desc="tabDesc",
              :data="data || {}",
              :meta="meta",
              :disabled="loading"
            )
          dito-panel(
            :desc="formDesc",
            :data="data || {}",
            :meta="meta",
            :disabled="loading"
          )
          .dito-buttons
            button.dito-button.dito-button-cancel(
              type="button",
              @click.prevent="cancel"
            )
            button.dito-button(
              v-if="!errors.has('dito-data')",
              type="submit",
              :class="`dito-button-${create ? 'create' : 'save'}`"
            )
    router-view(v-if="!isLastRoute")
</template>

<style lang="sass">
.dito
  .dito-form
    &,
    form
      // To make vertical scrolling in .dito-scroll work
      display: flex
      flex-flow: column
    .dito-content
      margin: -$form-spacing 0
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
import RouteMixin from '@/mixins/RouteMixin'
import DataMixin from '@/mixins/DataMixin'
import clone from '@/utils/clone'

export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin],

  data() {
    return {
      createData: null,
      resetData: null,
      isForm: true,
      components: {}
    }
  },

  computed: {
    name() {
      return this.formDesc.name
    },

    create() {
      // this.param is inherited from RouteMixin
      return this.param === 'create'
    },

    id() {
      return this.create ? null : this.param
    },

    method() {
      return this.create ? 'post' : 'patch'
    },

    transient() {
      const parent = this.parentFormComponent
      return parent && (parent.transient || parent.create)
    },

    endpoint() {
      return this.transient
          ? '_transient_'
          : this.getEndpoint(this.method,
              this.create ? 'collection' : 'member',
              this.id)
    },

    tabs() {
      return this.formDesc.tabs
    },

    selectedTab() {
      let hash = this.$route.hash
      return hash && hash.substring(1) ||
          this.tabs && Object.keys(this.tabs)[0] || ''
    },

    data() {
      // Return differnent data "containers" based on different scenarios:
      // 1. createData, if we're in a form for a newly created object.
      // 2. loadedData, if the form itself is the root of the data (e.g. when
      //    directly loading an editing root).
      // 3. The data inherited from the parent, which itself may be either a
      //    view that loaded the data, or a form that either loaded the data, or
      //    also inherited it from its parent.
      return this.createData || this.loadedData || this.parentEntry
    },

    parentData() {
      return this.parentRouteComponent.data
    },

    parentList() {
      // Possible parents are DitoForm for nested forms, or DitoView for root
      // lists. Both have a data property which abstracts away loading and
      // inheriting of data.
      const parentData = this.parentData
      const name = this.viewDesc.name
      // If there is parentData but no list, create and return it on the fly.
      return parentData && (parentData[name] || this.$set(parentData, name, []))
    },

    parentEntry() {
      // See if we can find entry by id in the parent list.
      const list = this.parentList
      const entry = list && this.id && list.find(
          entry => entry.id + '' === this.id)
      // If we found the entry in the parent list and there is no resetData
      // object already, store a clone of the entry for restoring on cancel.
      if (entry && !this.resetData) {
        this.resetData = clone(entry)
      }
      return entry
    },

    shouldLoad() {
      // Only load data if this component is the last one in the route and we
      // can't inherit the data from the parent already, see data():
      return this.isLastRoute && !this.create && !this.data
    },

    isDirty() {
      return Object.keys(this.fields).some(key => this.fields[key].dirty)
    }
  },

  methods: {
    initData() { // overrides DataMixin.initData()
      function initData(desc, data) {
        // Sets up an createData object that has keys with null-values for all
        // form fields, so they can be correctly watched for changes.
        for (let key in desc.tabs) {
          initData(desc.tabs[key], data)
        }
        for (let key in desc.components) {
          data[key] = null
        }
        return data
      }

      if (this.create) {
        if (!this.createData) {
          this.createData = initData(this.formDesc, {})
        }
      } else {
        // super.initData()
        DataMixin.methods.initData.call(this)
      }
    },

    reloadData() {
      if (!this.create) {
        // super.reloadData()
        DataMixin.methods.reloadData.call(this)
      }
    },

    setParentEntry(data) {
      if (this.parentEntry) {
        const index = this.parentList.indexOf(this.parentEntry)
        if (index >= 0) {
          this.$set(this.parentList, index,
              Object.assign({}, this.parentEntry, data))
          return true
        }
      }
      return false
    },

    filterData(data) {
      // Deletes arrays that aren't considered nested data, as those are already
      // taking care of themselves (e.g. insertion, deletion) and shouldn't be
      // set again. This also handles canceling (resetData) nicely even when
      // children were already edited.
      let copy = {}
      for (let key in data) {
        const value = data[key]
        if (Array.isArray(value)) {
          const comp = this.components[key]
          // Only check for nested on list items that actuall load data, since
          // other components can have array values too.
          if (comp && comp.isList && !comp.desc.nested) {
            continue
          }
        }
        copy[key] = value
      }
      return copy
    },

    setData(data) {
      // setData() is called after submit when data has changed. Try to modify
      // the parentEntry first to keep data persistant across editing hierarchy.
      if (!this.setParentEntry(data)) {
        this.loadedData = data
      }
    },

    goBack(reload, checkDirty) {
      if (!checkDirty || (!this.isDirty || confirm(
          'You have unsaved changed. Do you really want to go back?'))) {
        this.$router.push({ path: '..', append: true })
        // Tell the parent to reload its data if this was a submit()
        const parent = this.parentRouteComponent
        if (reload && parent) {
          parent.reloadData()
        }
      }
    },

    submit() {
      this.$validator.validateAll()
        .then(() => this.store())
        // TODO: Implement nicer dialogs and info / error flashes...
        .catch(() => alert('Please correct the validation errors.'))
    },

    store() {
      if (!this.transient) {
        this.request(this.method, this.endpoint, null, this.data, err => {
          if (!err) {
            // After submitting, navigate back to the parent form or view.
            this.goBack(true, false)
          }
        })
      } else {
        // We're dealing with a create form with nested forms, so have to deal
        // with transient objects. When editing nested transient, nothing needs
        // to be done as it just works, but when creaing, we need to add to /
        // create the parent list.
        let ok = true
        if (this.create) {
          const parentList = this.parentList
          if (parentList) {
            // Determine a unique id for the new entry, prefixed with '_' so we
            // can identify transient objects, see isTransient()
            let id = 0
            for (let entry of parentList) {
              id = Math.max(+(entry.id + '').substring(1) || 0, id)
            }
            const data = this.data
            data.id = `_${id + 1}`
            parentList.push(data)
          } else {
            ok = false
            this.errors.add('dito-data', 'Unable to create item.')
          }
        }
        if (ok) {
          this.goBack(false, false)
        }
      }
    },

    cancel() {
      // If we have resetData, see if we can reset the entry in the parent list
      // to its original state again.
      if (this.resetData) {
        this.setParentEntry(this.filterData(this.resetData))
        this.resetData = null
      }
      this.goBack(false, true)
    }
  }
})
</script>
