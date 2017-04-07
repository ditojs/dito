<template lang="pug">
  div
    p API endpoint: {{ endpoint }}
    p.loading(v-if="loading") Loading...
    component(v-if="data", :is="typeToComponent($meta.view.type)", :name="$meta.name", :desc="$meta.view", :data="data", @remove="remove")
</template>

<script>
import RouterComponent from '@/RouterComponent'

export default RouterComponent.component('dito-view', {
  emptyData() {
    return []
  },

  computed: {
    endpoint() {
      return this.getIndexEndpoint()
    },

    visible() {
      return
    }
  }
})
</script>
