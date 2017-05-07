<template lang="pug">
  div(v-if="isLastRoute")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    component(
      :is="typeToComponent(viewDesc.type)",
      :name="name",
      :desc="viewDesc",
      :data="data",
      :meta="meta"
    )
  router-view(v-else)
</template>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'

export default DitoComponent.component('dito-view', {
  mixins: [RouteMixin],

  data() {
    return {
      isView: true,
      viewData: {}
    }
  },

  computed: {
    name() {
      return this.viewDesc.name
    },

    data() {
      // Set up viewData so we can pass it on to the nested component which
      // will look up its own data under its name, e.g. see listData().
      // NOTE: We need to reuse an object defined in data(), so that child
      // components can modify its content, see DitoList#setData()
      this.$set(this.viewData, this.name, this.loadedData || [])
      return this.viewData
    },

    endpoint() {
      return this.getEndpoint('get', 'collection')
    },

    shouldLoad() {
      return this.isLastRoute && !this.loadedData
    }
  },

  watch: {
    $route(to, from) {
      // Only erase loadedData if the routes changes completely.
      let path1 = to.path
      let path2 = from.path
      if (path2.length < path1.length) {
        [path1, path2] = [path2, path1]
      }
      if (path2.indexOf(path1) !== 0) {
        this.loadedData = null
      }
    }
  }
})
</script>
