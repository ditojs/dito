<template lang="pug">
  form(@submit="submit")
    p API path: {{ path }}
    p.loading(v-if="loading") Loading...
    ul
      dito-form-field(v-for="(desc, name) in $meta.form", :key="name", :label="desc.label")
        component(:is="typeToComponent(desc.type)", :name="name", :desc="desc", :data="data")
    button(type="submit") {{ $meta.create ? 'Create' : 'Save' }}
    router-link(tag="button", to="..", append) Cancel
</template>

<script>
import DitoRouterComponent from '@/DitoRouterComponent'

export default DitoRouterComponent.component('dito-form', {
  props: ['id'],

  emptyData() {
    return {}
  },

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
      event.preventDefault()
      this.send(this.create ? 'post' : 'put', this.path, this.data, () => {
        this.$router.push({ path: '..', append: true })
      })
    }
  }
})
</script>
