<template lang="pug">
  div
    p API path: {{ path }}
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
    path() {
      return this.getViewPath()
    },

    visible() {
      return
    }
  }
})
</script>
