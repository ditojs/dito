<template lang="pug">
  div
    | API path: {{ $meta.path }}
    .loading(v-if="loading")
      | Loading...
    component(:is="typeToComponent($meta.view.type)", :name="$meta.name", :props="$meta.view", :data="data")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-view', {
  data() {
    return {
      loading: false,
      data: null,
      error: null
    }
  },

  created() {
    // Fetch data after view was created and the data is already being observed.
    this.fetch()
  },

  watch: {
    // Call fetch() again when the route changes, to support component reuse.
    '$route': 'fetch'
  },

  methods: {
    fetch() {
      this.error = this.data = null
      this.loading = true
      this.request('get', this.$meta.path, (err, data) => {
        this.loading = false
        if (err) {
          this.error = err.toString()
        } else {
          this.data = data
        }
      })
    }
  }
})
</script>
