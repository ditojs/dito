<template lang="pug">
  div(:id="name")
    ul
      dito-list-item(v-for="item in data", :key="item.id", :item="item", :render="render")
        router-link(tag="button", :to="`${item.id}`", append) Edit
        button(@click="$emit('remove', item)") Delete
    router-link(tag="button", to="create", append) Create
</template>

<script>
import DitoComponent from '@/DitoComponent'
import { compile } from '@/utils/template'

export default DitoComponent.type('list', {
  props: {
    data: { type: Array, required: false }
  },

  computed: {
    render() {
      let desc = this.desc
      return desc.render || desc.template && compile(desc.template, 'item')
    }
  }
})
</script>
