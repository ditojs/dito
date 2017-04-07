<template lang="pug">
  form.dito-form(@submit="submit")
    dito-spinner.dito-spinner(:loading="loading")
    .dito-debug API endpoint: {{ endpoint }}
    .dito-content
      ul.dito-list
        li(v-for="(desc, name) in meta.form", v-if="typeof desc === 'object'")
          dito-label(v-if="desc.label", :name="name", :text="desc.label")
          component(:is="typeToComponent(desc.type)", :name="name",
            :desc="desc", :data="data", @remove="remove",
            :disabled="desc.disabled || loading")
      .dito-buttons
        button(type="submit") {{ create ? 'Create' : 'Save' }}
        router-link(tag="button", to="..", append) Cancel
</template>

<style lang="sass">
  // Move the submit button that needs to appear first in markup in order to
  // be the default after the Cancel button using floating inside inline-block.
  .dito-list + .dito-buttons
    display: inline-block
    button
      float: left
      &[type="submit"]
        float: right
</style>

<script>
import RouterComponent from '@/RouterComponent'

export default RouterComponent.component('dito-form', {
  props: ['id'],

  computed: {
    create() {
      return !!this.meta.create
    },

    shouldLoad() {
      return !this.create
    },

    method() {
      return this.create ? 'post' : 'put'
    },

    endpoint() {
      return this.getEndpoint(this.method, this.id)
    }
  },

  methods: {
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
