<template lang="pug">
  form(@submit="submit")
    p API endpoint: {{ endpoint }}
    p.loading(v-if="loading") Loading...
    ul
      dito-form-field(v-for="(desc, name) in $meta.form", v-if="name != 'endpoint'", :key="name", :label="desc.label")
        component(:is="typeToComponent(desc.type)", :name="name", :desc="desc", :disabled="desc.disabled || loading", :data="data", @remove="remove")
    button(type="submit") {{ $meta.create ? 'Create' : 'Save' }}
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

    load() {
      return !this.create
    },

    endpoint() {
      return this.create
          ? this.getIndexEndpoint()
          : this.getItemEndpoint(this.param)
    }
  },

  methods: {
    submit(event) {
      event.preventDefault()
      this.send(this.create ? 'post' : 'put', this.endpoint, this.data, () => {
        this.$router.push({ path: '..', append: true })
      })
    }
  }
})
</script>
