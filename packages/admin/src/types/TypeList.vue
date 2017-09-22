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
        :count="count || 0"
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
            v-if="columns"
            v-for="column in columns"
            :class="column.class"
            :style="column.style"
          )
            component(
              v-if="column.component"
              :is="column.component"
              :item="item"
            )
            span(
              v-else
              v-html="renderColumn(column, item)"
            )
          td(
            v-else
          )
            component(
              v-if="schema.component"
              :is="schema.component"
              :item="item"
            )
            span(
              v-else-if="schema.render"
              v-html="schema.render(item)"
            )
          td.dito-buttons.dito-buttons-round(v-if="hasButtons")
            button.dito-button(
              v-if="schema.draggable"
              type="button"
              class="dito-button-drag"
            )
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
$list-spacing: 1px
$buttons-padding: 2px

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
    > table
      width: 100%
      border-spacing: 0 $list-spacing
      &:not(:empty)
        margin: -$list-spacing 0
        & + .dito-buttons
          margin-top: $list-spacing
      > thead,
      > tbody
        > tr
          vertical-align: baseline
          > td
            padding: $form-spacing
            background: $color-lightest
            // Add rounded corners in first & last headers
            &:first-child
              border-top-left-radius: $border-radius
              border-bottom-left-radius: $border-radius
            &:last-child
              border-top-right-radius: $border-radius
              border-bottom-right-radius: $border-radius
            & + td
              border-left: 1px solid white
            &.dito-buttons
              width: 1%
              padding: $buttons-padding
    .dito-buttons
      vertical-align: top
      text-align: right
      padding: $buttons-padding
      background: $color-lightest
      border-radius: $border-radius
      .dito-button-drag
        cursor: grab
        &:active,
          cursor: grabbing
</style>

<script>
import TypeComponent from '@/TypeComponent'
import VueDraggable from 'vuedraggable'
import ListMixin from '@/mixins/ListMixin'

export default TypeComponent.register('list', {
  mixins: [ListMixin],
  components: {VueDraggable},

  computed: {
    paginate() {
      return this.schema.paginate
    },

    hasButtons() {
      const {value, schema} = this
      return !!(value && value.length > 0 &&
        (schema.editable || schema.deletable || schema.draggable))
    },

    dragOptions() {
      return {
        animation: 150,
        disabled: !this.schema.draggable,
        handle: '.dito-button-drag',
        ghostClass: 'dito-drag-ghost'
      }
    }
  }
})
</script>
