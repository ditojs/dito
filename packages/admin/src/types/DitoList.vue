<template lang="pug">
  dito-errors(
    v-if="errors.has('dito-data')",
    name="dito-data"
  )
  div(v-else)
    ul.dito-list.dito-table
      li(v-for="item in listData || []", :key="`${name}-${item.id}`")
        span(v-html="render(item)")
        .dito-buttons(v-if="desc.editable || desc.deletable")
          router-link(
            v-if="desc.editable",
            :to="`${route}${item.id}`", append,
            tag="button",
            type="button",
            class="dito-button-edit"
          )
          button(
            v-if="desc.deletable",
            type="button",
            @click="remove(item)",
            class="dito-button-delete"
          )
    .dito-buttons(v-if="desc.creatable")
      router-link(
        :to="`${route}create`", append,
        tag="button",
        type="button",
        class="dito-button-create"
      )
</template>

<style lang="sass">
.dito
  .dito-list
    border-spacing: 0.2em
    padding-bottom: 0.5em
</style>

<script>
import DitoComponent from '@/DitoComponent'
import ListMixin from '@/mixins/ListMixin'
import { compile } from '@/utils/template'
import escapeHtml from '@/utils/escapeHtml'
import stripTags from '@/utils/stripTags'

export default DitoComponent.register('list', {
  mixins: [ListMixin],

  computed: {
    render() {
      const desc = this.desc
      return desc.render ||
          desc.template && compile(desc.template, 'item') ||
          (item => item.html || escapeHtml(item.text))
    }
  },

  methods: {
    getTitle(item) {
      return stripTags(this.render(item))
    }
  }
})
</script>
