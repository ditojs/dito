<template lang="pug">
  form.dito-form(@submit="submit")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    .dito-content
      dito-panel(:desc="meta.form", :name="meta.name", :data="data",
        :disabled="loading")
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

// Recursively sets up a new data object that has keys with null-values for all
// form fields, so they can be correctly watched for changes.
function setupData(descriptions, data) {
  for (let name in descriptions) {
    let desc = descriptions[name]
    if (typeof desc === 'object') {
      if (desc.type === 'tab') {
        setupData(desc, data)
      } else {
        data[name] = null
      }
    }
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
