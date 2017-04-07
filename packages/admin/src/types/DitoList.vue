<template lang="pug">
  div(:id="name")
    ul
      dito-list-item(v-for="item in data", :key="item.id", :item="item", :render="render")
        router-link(tag="button", :to="`${item.id}`", append) Edit
        button(@click="$emit('remove', item)") Delete
    router-link(tag="button", to="create", append) Create
</template>

<script>
import TypeComponent from '@/TypeComponent'
import { compile } from '@/utils/template'

export default TypeComponent.register('list', {
  props: {
    data: { type: Array, required: false }
  },

  computed: {
    render() {
      const desc = this.desc
      return desc.render || desc.template && compile(desc.template, 'item')
    }
  }
})
</script>
