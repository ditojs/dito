<template lang="pug">
  form.dito-form(v-if="isLastRoute", @submit="submit")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    .dito-content
      .dito-error(v-if="error") {{ error }}
      template(v-else)
        dito-tabs(:name="name", :tabs="form.tabs", :data="data", :user="user",
          :disabled="loading")
        dito-panel(:desc="form", :data="data", :user="user", :disabled="loading")
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
import RouterComponent from '@/RouterComponent'

// Sets up a new data object that has keys with null-values for all form fields,
// so they can be correctly watched for changes.
function initData(desc, data) {
  for (let key in desc.tabs) {
    initData(desc.tabs[key], data)
  }
  for (let key in desc.components) {
    data[key] = null
  }
  return data
}

export default RouterComponent.component('dito-form', {
  props: {
    id: { type: String, required: false }
  },

  computed: {
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
    }
  },

  methods: {
    initData() {
      if (this.create) {
        this.data = initData(this.form, {})
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
