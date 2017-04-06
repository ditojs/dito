<template lang="pug">
  form(@submit="submit")
    p API path: {{ path }}
    p.loading(v-if="loading") Loading...
    ul
      dito-form-field(v-for="(desc, name) in $meta.form", v-if="name != 'endpoint'", :key="name", :label="desc.label")
        component(:is="typeToComponent(desc.type)", :name="name", :desc="desc", :disabled="desc.disabled || loading", :data="data", @remove="remove")
    button(type="submit") {{ $meta.create ? 'Create' : 'Save' }}
    router-link(tag="button", to="..", append) Cancel
</template>

<script>
import DitoRouterComponent from '@/DitoRouterComponent'

export default DitoRouterComponent.component('dito-form', {
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

    path() {
      return this.create ? this.getViewPath() : this.getFormPath(this.param)
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
