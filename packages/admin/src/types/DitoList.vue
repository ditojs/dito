<template lang="pug">
  .dito-list
    dito-errors(
      v-if="errors.has('dito-request')"
      name="dito-request"
    )
    .dito-header
      dito-scopes(
        v-if="scopes"
        :filter="filter"
        :scopes="scopes"
      )
      dito-pagination(
        v-if="schema.paginate"
        :filter="filter"
        :paginate="schema.paginate"
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
          td.dito-buttons(v-if="hasButtons")
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
    .dito-buttons(v-if="schema.creatable")
      router-link.dito-button(
        :to="`${path}create`" append
        tag="button"
        type="button"
        :class="`dito-button-${verbCreate}`"
      )
</template>

<style lang="sass">
$list-spacing: 3px

.dito
  .dito-list
    .dito-header
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
        padding: $list-spacing 0 $list-spacing $form-spacing
        background: $color-lightest
      // Support simple nested table styling
      table
        border-spacing: 0
        td
          padding: 0
          & + td
            padding-left: $form-spacing
      // Add rounded corners in first & last cells / headers
      td,
      th,
        &:first-child
          &,
          button
            border-top-left-radius: $border-radius
            border-bottom-left-radius: $border-radius
        &:last-child
          &,
          button
            border-top-right-radius: $border-radius
            border-bottom-right-radius: $border-radius
    .dito-drag-ghost
      opacity: 0
    .dito-buttons
      text-align: right
      padding: $list-spacing
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
