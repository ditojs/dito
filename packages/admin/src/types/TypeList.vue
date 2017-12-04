<template lang="pug">
  .dito-list
    .dito-filters(v-if="scopes || paginate")
      dito-scopes(
        v-if="scopes"
        :query="query"
        :scopes="scopes"
      )
      dito-pagination(
        v-if="paginate"
        :query="query"
        :limit="paginate"
        :total="total || 0"
      )
    table
      dito-headers(
        v-if="columns"
        :query="query"
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
          :key="index"
        )
          template(v-if="columns")
            td(
              v-for="column in columns"
              :class="column.class"
              :style="column.style"
            )
              // TODO: Implement inline components in column mode!
              component(
                v-if="column.component"
                :is="column.component"
                :item="item"
              )
              span(
                v-else
                v-html="renderColumn(column, item)"
              )
          template(v-else)
            td
              dito-panel(
                v-if="schema.inline"
                :schema="getFormSchema(item)"
                :data="item"
                :meta="getInlineMeta(meta)"
                :prefix="`${name}/${index}/`"
                :store="store"
                :disabled="loading"
              )
              component(
                v-else-if="schema.component"
                :is="schema.component"
                :item="item"
              )
              span(
                v-else-if="schema.render"
                v-html="schema.render(item)"
              )
              span(
                v-else
                v-html="getItemTitle(item, index)"
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
              @click="deleteItem(item, index)"
              :class="`dito-button-${verbDelete}`"
            )
      tfoot(v-if="creatable")
        tr
          td.dito-buttons.dito-buttons-round(:colspan="numColumns")
            dito-form-chooser(
              :schema="schema"
              :path="path"
              :verb="verbCreate"
            )
</template>

<style lang="sass">
$list-spacing: 1px
$buttons-padding: 2px

.dito
  .dito-list
    border-radius: $border-radius
    .dito-filters
      overflow: auto
      padding-bottom: $form-margin / 2
      margin-top: -$form-margin / 2
      +user-select(none)
      .dito-scopes
        float: left
      .dito-pagination
        float: right
    .dito-buttons
      width: 1%
      text-align: right
      vertical-align: top // For vertical-align: baseline in normal td to work.
      line-height: 1em
      border-top: 1px solid $color-white
      .dito-button-drag
        cursor: grab
        &:active,
          cursor: grabbing
    > table
      width: 100%
      border-spacing: 0
      &:not(:empty)
        margin: -$list-spacing 0
      > tbody,
      > tfoot
        > tr
          vertical-align: baseline
          > td
            border-top: 1px solid $color-white
            padding: $form-spacing
            background: $color-lightest
            border-radius: 0
            &.dito-buttons
              padding-left: 0
            // Add rounded corners in first & last headers.
            &:first-child
              border-top-left-radius: $border-radius
              border-bottom-left-radius: $border-radius
            &:last-child
              border-top-right-radius: $border-radius
              border-bottom-right-radius: $border-radius
      > tbody
        > tr:first-child
          > td
            // Top row does not need a border at the top...
            // But to make vuedraggable happy, hide it with background color.
            border-color: $color-lightest
      > thead + tbody
        > tr
          &:first-child
            > td
              // ...except if there is a thead as well, then they need it again.
              border-top: 1px solid $color-white
          > td
            padding: $table-spacing
            & + td
              // Also, only add horizontal borders if there is a heaader
              border-left: 1px solid $color-white
        &,
        & + tfoot
          > tr
            > td.dito-buttons
              padding: $buttons-padding
      > tbody:empty + tfoot
        > tr
          > td
            // All by its own, ther is no need for the border.
            border-top: 0
    // Nested .dito-list:
    .dito-list
      // Give nested lists a bit of shadow
      box-shadow: 0 1px 3px 0 rgba($color-shadow, 0.25)
      margin: ($form-spacing / 2) 0
      > table
        > tbody,
        > tfoot
          > tr
            // Change corner rounding in nested lists, so that only the four
            // outer corners are rounded to go with the shadow.
            > td
              border-radius: 0
            &:first-child
              > td:first-child
                border-top-left-radius: $border-radius
              > td:last-child
                border-top-right-radius: $border-radius
            &:last-child
              > td:first-child
                border-bottom-left-radius: $border-radius
              > td:last-child
                border-bottom-right-radius: $border-radius
</style>

<script>
import TypeComponent from '@/TypeComponent'
import ListMixin from '@/mixins/ListMixin'

export default TypeComponent.register('list', {
  mixins: [ListMixin],

  computed: {
    paginate() {
      return this.schema.paginate
    },

    hasButtons() {
      const { value, schema } = this
      return !!(value && value.length > 0 &&
        (schema.editable || schema.deletable || schema.draggable))
    },

    creatable() {
      const { schema } = this
      return schema.creatable && (schema.form || schema.forms)
    },

    numColumns() {
      return (this.columns ? this.columns.length : 1) +
        (this.creatable ? 1 : 0)
    },

    dragOptions() {
      return {
        animation: 150,
        disabled: !this.schema.draggable,
        handle: '.dito-button-drag',
        ghostClass: 'dito-drag-ghost'
      }
    }
  },

  methods: {
    getInlineMeta(meta) {
      return {
        ...meta,
        listSchema: this.schema
      }
    }
  }
})
</script>
