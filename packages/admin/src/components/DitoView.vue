<template lang="pug">
  div
    | API: {{ $meta.url }}
    component(:is="typeToComponent($meta.view.type)", :name="$meta.name", :props="$meta.view", :data="data")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-view', {
  computed: {
    data() {
      return this.$meta.name === 'addresses'
          ? [
            { id: 1, text: 'Address 1' },
            { id: 2, text: 'Address 2' }
          ]
          : [
            { id: 1, text: 'User 1' },
            { id: 2, text: 'User 2' }
          ]
    }
  }
})
</script>
