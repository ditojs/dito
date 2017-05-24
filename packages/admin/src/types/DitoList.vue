<template lang="pug">
  dito-errors(
    v-if="errors.has('dito-data')",
    name="dito-data"
  )
  div(v-else)
    .dito-scopes(v-if="desc.scopes")
      button.dito-button(
        v-for="scope in desc.scopes",
        type="button",
        @click="filterByScope({ scope: scope.toLowerCase() })"
      )
        | {{ scope }}
    ul.dito-list.dito-table
      li(v-for="item in listData || []", :key="`${name}-${item.id}`")
        span(v-html="render(item)")
        // TODO: move buttons into render() so v-html can be called on li
        // since that would allow for easier styling with table-cell
        .dito-buttons(v-if="desc.editable || desc.deletable")
          router-link(
            v-if="desc.editable",
            :to="`${route}${item.id}`", append,
            tag="button",
            type="button",
            class="dito-button dito-button-edit"
          )
          button.dito-button.dito-button-delete(
            v-if="desc.deletable",
            type="button",
            @click="remove(item)"
          )
    .dito-buttons(v-if="desc.creatable")
      router-link(
        :to="`${route}create`", append,
        tag="button",
        type="button",
        class="dito-button dito-button-create"
      )
</template>

<style lang="sass">
.dito
  .dito-list
    border-spacing: 0.2em
    padding-bottom: 0.5em
  .dito-scopes
    padding-bottom: 0.5em
    font-size: 0.9em
    .dito-button
      border-radius: 0
      border-top-left-radius: 1em
      border-bottom-left-radius: 1em
      padding-left: 1em
      padding-right: 1em
      & + .dito-button
        border-radius: 0
        border-top-right-radius: 1em
        border-bottom-right-radius: 1em
        border-left: 1px solid $border-color
        &:focus
          border-left-color: $color-active
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
