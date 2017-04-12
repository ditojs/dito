<template lang="pug">
  form.dito-form(@submit="submit")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    .dito-content
      dito-tabs(:name="meta.name", :tabs="meta.form.tabs", :data="data", :disabled="loading")
      dito-panel(:desc="meta.form", :data="data")
      .dito-buttons
        button(type="submit") {{ create ? 'Create' : 'Save' }}
        router-link(tag="button", to="..", append) Cancel
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
import RouterComponent from '@/RouterComponent'

// Sets up a new data object that has keys with null-values for all form fields,
// so they can be correctly watched for changes.
function setupData(desc, data) {
  for (let key in desc.tabs) {
    setupData(desc.tabs[key], data)
  }
  for (let key in desc.components) {
    data[key] = null
  }
  return data
}

export default RouterComponent.component('dito-form', {
  props: ['id'],

  computed: {
    create() {
      return !!this.meta.create
    },

    method() {
      return this.create ? 'post' : 'put'
    },

    endpoint() {
      return this.getEndpoint(this.method, 'member', this.id)
    }
  },

  methods: {
    setupData() {
      if (this.create) {
        this.data = setupData(this.meta.form, {})
      } else {
        this.loadData(true)
      }
    },

    submit(event) {
      event.preventDefault()
      this.send(this.method, this.endpoint, this.data, (err) => {
        if (!err) {
          // After submitting the form, navigate back to the view
          this.$router.push({ path: '..', append: true })
        }
      })
    }
  }
})
</script>
