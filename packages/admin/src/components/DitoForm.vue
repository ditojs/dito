<template lang="pug">
  form(@submit="submit")
    p API path: {{ path }}
    p.loading(v-if="loading") Loading...
    ul
      dito-form-field(v-for="(desc, name) in $meta.form", :key="name", :label="desc.label")
        component(:is="typeToComponent(desc.type)", :name="name", :desc="desc", :data="data || {}")
    router-link(tag="button", to="..", append) Cancel
    button(type="submit") {{ $meta.create ? 'Create' : 'Save' }}
</template>

<script>
import DitoRouterComponent from '@/DitoRouterComponent'

export default DitoRouterComponent.component('dito-form', {
  props: ['id'],

  computed: {
    create() {
      return this.$meta.create
    },

    load() {
      return !this.create
    },

    path() {
      let meta = this.$meta
      return meta.create ? meta.path : `${meta.path}/${this.id}`
    }
  },

  methods: {
    submit(event) {
      this.send(this.create ? 'post' : 'put', this.path, this.data, () => {
        this.$router.push({ path: '..', append: true })
      })
      event.preventDefault()
    }
  }
})
</script>
