<template lang="pug">
  div(v-if="isLastRoute")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    component(:is="typeToComponent(view.type)", :name="meta.name", :desc="view",
      :data="data", :meta="meta", :root="true")
  router-view(v-else)
</template>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'

export default DitoComponent.component('dito-view', {
  mixins: [RouteMixin],

  computed: {
    data() {
      // Set up the data so we can pass it on to the nested component which
      // will look up its own data under its name, e.g. see listData().
      return {
        [this.meta.name]: this.loadedData || []
      }
    },

    shouldLoad() {
      return this.isLastRoute
    },

    endpoint() {
      return this.getEndpoint('get', 'collection')
    }
  }
})
</script>
