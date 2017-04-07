<template lang="pug">
  div(v-if="isLastRoute")
    dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    component.dito-content(v-if="data", :is="typeToComponent(meta.view.type)", :name="meta.name", :desc="meta.view", :data="data", @remove="remove")
  router-view(v-else)
</template>

<script>
import RouterComponent from '@/RouterComponent'

export default RouterComponent.component('dito-view', {
  computed: {
    endpoint() {
      return this.getEndpoint('index')
    }
  }
})
</script>
