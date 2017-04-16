<template lang="pug">
  div(v-if="isLastRoute")
    .dito-spinner
      dito-spinner(v-if="loading")
    .dito-debug API endpoint: {{ endpoint }}
    component.dito-content(v-if="data", :is="typeToComponent(view.type)",
      :name="name", :desc="view", :data="data", :user="user", :root="true",
      @remove="remove")
  router-view(v-else)
</template>

<script>
import DitoComponent from '@/DitoComponent'
import RouteMixin from '@/mixins/RouteMixin'
import DataMixin from '@/mixins/DataMixin'

export default DitoComponent.component('dito-view', {
  mixins: [RouteMixin, DataMixin],

  computed: {
    endpoint() {
      return this.getEndpoint('get', 'collection')
    }
  },

  methods: {
    setData(data) {
      // In order to set up proper bindings between form components and member
      // items, we need to access the attribute values through data[name].
      // Passing the values as a prop to the component wouldn't work, since the
      // binding needs to happen through a lookup on data. For views, we need
      // to set up data so that the lookup by name works too:
      this.data = { [this.name]: data }
    }
  }
})
</script>
