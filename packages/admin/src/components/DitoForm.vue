<template lang="pug">
  form.dito-form(v-if="isLastRoute", @submit="submit")
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
      router-link(tag="button", to="..", append) Cancel
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
import DataMixin from '@/mixins/DataMixin'

export default DitoComponent.component('dito-form', {
  mixins: [RouteMixin, DataMixin],

  data() {
    return {
      emptyData: null
    }
  },

  computed: {
    data() {
      return this.emptyData || this.loadedData || this.parentData
    },

    parentData() {
      // See if we can find entry by id in parent data. Possible parents are
      // DitoForm for nested forms, or DitoView for root lists.
      const parentData = this.$parent.data
      const data = parentData && parentData[this.view.name]
      return data && data.find(entry => entry.id + '' === this.id)
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
      return this.isLastRoute && !this.parentData
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
      } else {
        this.loadData(true)
      }
    },

    submit(event) {
      event.preventDefault()
      this.send(this.method, this.endpoint, this.data, err => {
        if (!err) {
          // After submitting the form, navigate back to the view.
          this.$router.push({ path: '..', append: true })
        }
      })
    }
  }
})
</script>
