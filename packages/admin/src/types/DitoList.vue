<template lang="pug">
  div
    ul.dito-list
      li(v-for="item in data", :key="item.id")
        span(v-html="render && render(item) || item.html || escape(item.text)")
        .dito-buttons
          router-link(tag="button", :to="`${item.id}`", append) Edit
          button(@click="$emit('remove', item)") Delete
    .dito-buttons
      router-link(tag="button", to="create", append) Create
</template>

<style lang="sass">
  // Used both by DitoList and DitoPane
  ul.dito-list
    display: table
    border-spacing: 0.2em
    margin: 0.5em 0
    padding: 0
    li
      display: table-row
      margin: 0
      > *
        display: table-cell
</style>

<script>
import TypeComponent from '@/TypeComponent'
import { compile } from '@/utils/template'

export default TypeComponent.register('list', {
  props: {
    data: { type: [Array, Object], required: false }
  },

  computed: {
    render() {
      const desc = this.desc
      return desc.render || desc.template && compile(desc.template, 'item')
    }
  }
})
</script>
