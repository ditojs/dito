<template lang="pug">
  form(@submit="submit")
    p API endpoint: {{ endpoint }}
    p.loading(v-if="loading") Loading...
    ul
      dito-form-field(v-for="(desc, name) in $meta.form", v-if="name != 'endpoint'", :key="name", :label="desc.label")
        component(:is="typeToComponent(desc.type)", :name="name", :desc="desc", :disabled="desc.disabled || loading", :data="data", @remove="remove")
    button(type="submit") {{ create ? 'Create' : 'Save' }}
    router-link(tag="button", to="..", append) Cancel
</template>

<script>
import RouterComponent from '@/RouterComponent'

export default RouterComponent.component('dito-form', {
  props: ['param'],

  emptyData() {
    return {}
  },

  computed: {
    create() {
      return this.param === 'create'
    },

    method() {
      return this.create ? 'post' : 'put'
    },

    load() {
      return !this.create
    },

    endpoint() {
      return this.getEndpoint(this.method, this.param)
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
