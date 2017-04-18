<template lang="pug">
  form.dito-form(v-if="isLastRoute", @submit.prevent="submit")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    .dito-error(v-if="error") {{ error }}
    template(v-else)
      dito-tabs(:name="meta.name", :tabs="form.tabs", :data="data || {}",
        :meta="meta", :disabled="loading")
      dito-panel(:desc="form", :data="data || {}", :meta="meta",
        :disabled="loading")
    .dito-buttons
      button(type="submit", v-if="!error") {{ create ? 'Create' : 'Save' }}
      button(@click.prevent="cancel") Cancel
  router-view(v-else)
</template>

<style lang="sass">
  // Move the submit button that needs to appear first in markup in order to
  // be the default after the Cancel button using floating inside inline-block.
  .dito-panel + .dito-buttons
    display: inline-block
    button
      float: left
      &[type="submit"]
        float: right
</style>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'
import clone from '@/utils/clone'

export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin],

  data() {
    return {
      emptyData: null,
      resetData: null,
      isForm: true
    }
  },

  computed: {
    data() {
      return this.emptyData || this.loadedData || this.parentEntry
    },

    parentList() {
      // Possible parents are DitoForm for nested forms, or DitoView for root
      // lists. Both have a data property which abstracts away loading and
      // inheriting of data.
      const parentData = this.parentRouteComponent.data
      return parentData && parentData[this.view.name]
    },

    parentEntry() {
      // See if we can find entry by id in the parent list.
      const list = this.parentList
      const entry = list && list.find(entry => entry.id + '' === this.id)
      // If we found the entry in the parent list and there is no resetData
      // object already, store a clone of the entry for restoring on cancel.
      if (entry && !this.resetData) {
        this.resetData = clone(entry)
      }
      return entry
    },

    create() {
      return !!this.meta.create
    },

    method() {
      return this.create ? 'post' : 'put'
    },

    endpoint() {
      return this.getEndpoint(this.method,
          this.create ? 'collection' : 'member',
          this.id)
    },

    shouldLoad() {
      // Only load data if this component is the last one in the route and we
      // can't get the data from the parent already.
      return this.isLastRoute && !this.parentEntry
    }
  },

  methods: {
    initData() { // overrides DataMixin.initData()
      function initData(desc, data) {
        // Sets up an emptyData object that has keys with null-values for all
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
        this.emptyData = initData(this.form, {})
      } else if (this.shouldLoad) {
        this.loadData(true)
      }
    },

    submit() {
      this.send(this.method, this.endpoint, this.data, err => {
        if (!err) {
          // After submitting the form navigate back to the parent form or view.
          this.$router.push({ path: '..', append: true })
        }
      })
    },

    cancel() {
      // If we have resetData, see if we can reset the entry in the parent list
      // to its original state again.
      if (this.resetData && this.parentEntry) {
        const index = this.parentList.indexOf(this.parentEntry)
        if (index >= 0) {
          this.parentList[index] = this.resetData
        }
        this.resetData = null
      }
      this.$router.push({ path: '..', append: true })
    }
  }
})
</script>
