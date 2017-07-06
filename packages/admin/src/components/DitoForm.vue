<template lang="pug">
  .dito-form
    form(v-if="isLastRoute" @submit.prevent="submit")
      .dito-debug API endpoint: {{ endpoint }}
      dito-errors(
        v-if="errors.has('dito-data')"
        name="dito-data"
      )
      dito-tabs(
        :tabs="tabs"
        :selectedTab="selectedTab"
      )
      .dito-scroll
        .dito-content
          template(v-for="(tabDesc, key) in tabs")
            dito-panel(
              v-show="selectedTab === key"
              :desc="tabDesc"
              :data="data || {}"
              :meta="meta"
              :disabled="loading"
            )
          dito-panel(
            :desc="formDesc"
            :data="data || {}"
            :meta="meta"
            :disabled="loading"
          )
          .dito-buttons
            button.dito-button.dito-button-cancel(
              type="button"
              @click.prevent="cancel"
            )
            button.dito-button(
              v-if="!errors.has('dito-data')"
              type="submit"
              :class="`dito-button-${create ? verbCreate : verbSave}`"
            )
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
      createdData: null,
      clonedData: undefined,
      parentIndex: null,
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

    itemId() {
      return this.create ? null : this.param
    },

    method() {
      return this.create ? 'post' : 'patch'
    },

    endpoint() {
      return this.isTransient
        ? '_transient_'
        : this.getEndpoint(
          this.method,
          this.create ? 'collection' : 'member',
          this.itemId
        )
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
      const name = this.viewDesc.name
      // If there is parentData but no list, create and return it on the fly.
      return parentData && (parentData[name] || this.$set(parentData, name, []))
    },

    inheritedData() {
      // Data inherited from parent, and cloned to protect against reactive
      // changes until changes are applied through setParentData()
      const parentList = this.parentList
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
      return this.isLastDataRoute && !this.create && !this.data
    },

    isDirty() {
      return Object.keys(this.fields).some(key => this.fields[key].dirty)
    }
  },

  methods: {
    initData() { // overrides DataMixin.initData()
      const initData = (desc, data) => {
        // Sets up an createdData object that has keys with null-values for all
        // form fields, so they can be correctly watched for changes.
        for (let key in desc.tabs) {
          initData(desc.tabs[key], data)
        }
        for (let [key, compDesc] of Object.entries(desc.components)) {
          const comp = DitoComponent.get(compDesc.type)
          const initValue = comp && comp.options.methods.initValue
          data[key] = initValue ? initValue() : null
        }
        return data
      }

      if (this.create) {
        if (!this.createdData) {
          this.createdData = initData(this.formDesc, {})
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

    setParentData(data) {
      const clonedData = this.clonedData
      const index = this.parentIndex
      if (clonedData && index >= 0) {
        this.$set(this.parentList, index,
          Object.assign({}, clonedData, this.filterData(data)))
        return true
      }
      return false
    },

    filterData(data) {
      // Filters out arrays that aren't considered nested data, as those are
      // already taking care of themselves through their own end-points and
      // shouldn't be set.
      let copy = {}
      for (let [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          const comp = this.components[key]
          // Only check for nested on list items that actuall load data, since
          // other components can have array values too.
          if (comp && comp.isList && !comp.viewDesc.nested) {
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

    goBack(reload, checkDirty) {
      if (!checkDirty || (!this.isDirty || confirm(
        'You have unsaved changed. Do you really want to go back?'))
      ) {
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
      const data = this.data
      if (this.isTransient) {
        // We're dealing with a create form with nested forms, so have to deal
        // with transient objects. When editing nested transient, nothing needs
        // to be done as it just works, but when creating, we need to add to /
        // create the parent list.
        let ok = true
        if (this.create) {
          const parentList = this.parentList
          if (parentList) {
            parentList.push(data)
          } else {
            ok = false
            this.errors.add('dito-data', 'Unable to create item.')
          }
        } else {
          this.setParentData(data)
        }
        if (ok) {
          this.goBack(false, false)
        }
      } else {
        this.request(this.method, this.endpoint, null, data, error => {
          if (!error) {
            // After submitting, navigate back to the parent form or view.
            this.goBack(true, false)
          }
        })
      }
    },

    cancel() {
      this.goBack(false, true)
    }
  }
})
</script>
