<template lang="pug">
  div(v-if="isLastRoute")
    p API endpoint: {{ endpoint }}
    p.loading(v-if="loading") Loading...
    component(v-if="data", :is="typeToComponent(meta.view.type)", :name="meta.name", :desc="meta.view", :data="data", @remove="remove")
  router-view(v-else)
</template>

<script>
import RouterComponent from '@/RouterComponent'

export default RouterComponent.component('dito-view', {
  emptyData() {
    return []
  },

  computed: {
    endpoint() {
      return this.getEndpoint('index')
    }
  }
})
</script>
