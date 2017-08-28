<template lang="pug">
  .dito-list
    dito-errors(
      v-if="errors.has('dito-request')"
      name="dito-request"
    )
    .dito-filters(v-if="scopes || paginate")
      dito-scopes(
        v-if="scopes"
        :filter="filter"
        :scopes="scopes"
      )
      dito-pagination(
        v-if="paginate"
        :filter="filter"
        :paginate="paginate"
        :count="count"
      )
    table
      dito-headers(
        v-if="columns"
        :filter="filter"
        :columns="columns"
        :has-buttons="hasButtons"
      )
      vue-draggable(
        element="tbody"
        :list="value"
        :options="dragOptions"
      )
        tr(
          v-for="item, index in value || []"
          :key="`${name}-${item.id}`"
        )
          td(
            v-for="html in renderCells(item)"
            v-html="html"
          )
          td.dito-buttons.dito-buttons-round(v-if="hasButtons")
            router-link.dito-button(
              v-if="schema.editable"
              :to="`${path}${getItemId(item, index)}`" append
              tag="button"
              type="button"
              :class="`dito-button-${verbEdit}`"
            )
            button.dito-button(
              v-if="schema.deletable"
              type="button"
              @click="deleteItem(item)"
              :class="`dito-button-${verbDelete}`"
            )
    .dito-buttons.dito-buttons-round(v-if="schema.creatable")
      router-link.dito-button(
        :to="`${path}create`" append
        tag="button"
        type="button"
        :class="`dito-button-${verbCreate}`"
      )
</template>

<style lang="sass">

.dito
  .dito-list
    .dito-filters
      overflow: auto
      padding-bottom: $menu-padding-ver / 2
      +user-select(none)
      .dito-scopes
        float: left
      .dito-pagination
        float: right
    table
      width: 100%
      border-spacing: 0 $list-spacing
      &:not(:empty)
        margin: -$list-spacing 0
        & + .dito-buttons
          margin-top: $list-spacing
      tr
        vertical-align: baseline
      td
        padding: $list-padding 0 $list-padding $form-spacing
        background: $color-lightest
        // Support simple nested table styling
        &:first-child
          border-top-left-radius: $border-radius
          border-bottom-left-radius: $border-radius
        &:last-child
          border-top-right-radius: $border-radius
          border-bottom-right-radius: $border-radius
        & + td
          border-left: 1px solid white
      table
        border-spacing: 0
        td
          padding: 0
          & + td
            padding-left: $form-spacing
      // Add rounded corners in first & last headers
      .dito-buttons
        width: 1%
    .dito-drag-ghost
      opacity: 0
    .dito-buttons
      text-align: right
      padding: $list-padding
      background: $color-lightest
      border-radius: $border-radius
</style>

<script>
import DitoComponent from '@/DitoComponent'
import VueDraggable from 'vuedraggable'
import ListMixin from '@/mixins/ListMixin'

export default DitoComponent.register('list', {
  mixins: [ListMixin],
  components: {VueDraggable},

  computed: {
    paginate() {
      return this.count && this.schema.paginate
    },

    hasButtons() {
      return this.schema.editable || this.schema.deletable
    },

    dragOptions() {
      return {
        animation: 150,
        disabled: !this.schema.draggable,
        ghostClass: 'dito-drag-ghost'
      }
    }
  }
})
</script>
