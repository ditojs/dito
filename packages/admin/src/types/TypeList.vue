<template lang="pug">
  .dito-list(
    :class="schema.class"
    :style="schema.style"
  )
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
      dito-list-header(
        v-if="columns"
        :query="query"
        :columns="columns"
        :has-buttons="hasButtons"
      )
      vue-draggable(
        element="tbody"
        :list="listData"
        :options="dragOptions"
        @start="onStartDrag"
        @end="onEndDrag"
      )
        tr(
          v-for="item, index in listData || []"
          :key="getItemId(item, index)"
          :class="getInlineClass(item)"
        )
          template(v-if="columns")
            dito-list-cell(
              v-for="column in columns"
              :key="column.name"
              :column="column"
              :schema="schema"
              :dataPath="`${dataPath}/${index}`"
              :data="item"
              :meta="nestedMeta"
              :store="store"
              :disabled="disabled || loading"
            )
          template(v-else)
            td
              dito-inline-components(
                v-if="inline"
                :label="getItemLabel(item, { index, formLabel: false })"
                :schema="getFormSchema(item)"
                :dataPath="`${dataPath}/${index}`"
                :data="item"
                :meta="nestedMeta"
                :store="store"
                :disabled="disabled || loading"
              )
              component(
                v-else-if="component"
                :is="component"
                :data="item"
              )
              span(
                v-else-if="schema.render"
                v-html="schema.render(item)"
              )
              span(
                v-else
                v-html="getItemLabel(item, { index, formLabel: false })"
              )
          td.dito-buttons.dito-buttons-round(v-if="hasButtons")
            button.dito-button(
              v-if="draggable"
              type="button"
              class="dito-button-drag"
              :title="labelize(verbs.drag)"
            )
            router-link.dito-button(
              v-if="editable"
              :to="getEditRoute(item, index)" append
              tag="button"
              type="button"
              :class="`dito-button-${verbs.edit}`"
              :title="labelize(verbs.edit)"
            )
            button.dito-button(
              v-if="deletable"
              type="button"
              @click="deleteItem(item, index)"
              :class="`dito-button-${verbs.delete}`"
              :title="labelize(verbs.delete)"
            )
      tfoot(v-if="creatable")
        tr
          td.dito-buttons.dito-buttons-round(:colspan="numColumns")
            dito-form-chooser(
              :schema="schema"
              :path="path"
              :verb="verbs.create"
            )
</template>

<style lang="sass">
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
            border-top-color: $color-lightest
      > thead + tbody
        > tr
          &:first-child
            > td
              // ...except if there is a thead as well, then they need it again.
              border-top-color: $color-white
          > td
            padding: $table-spacing
            & + td
              // Also, only add horizontal borders if there is a heaader
              border-top-color: $color-white
        &,
        & + tfoot
          > tr
            > td.dito-buttons
              padding: $buttons-padding
      > tbody:empty + tfoot
        > tr
          > td
            // All by its own, ther is no need for the border.
            border-top-color: $color-lightest
    // Nested .dito-list:
    .dito-list
      // Give nested lists a bit of shadow
      box-shadow: 0 1px 3px 0 rgba($color-shadow, 0.25)
      margin: $form-spacing-half 0
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
  // Inline Rows
  tr.dito-inline-row
    display: block
    margin-bottom: $form-spacing
    tr.dito-inline-row
      margin-bottom: 0
    &.dito-inline-bar
      position: relative
      // Only style the td elements directly in this .dito-inline-bar,
      // not further nested ones:
      > table
        > tbody
          > tr
            > td
              display: block
              &.dito-buttons
                background: none
                position: absolute
                width: auto
                top: 0
                right: 0
                .dito-button:hover
                  background: $button-color-active
</style>

<script>
import VueDraggable from 'vuedraggable'
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import OrderedMixin from '@/mixins/OrderedMixin'

export default TypeComponent.register('list', {
  mixins: [SourceMixin, OrderedMixin],

  components: {
    VueDraggable
  },

  computed: {
    numColumns() {
      return (this.columns ? this.columns.length : 1) + (this.creatable ? 1 : 0)
    },

    hasButtons() {
      const { listData } = this
      return !!(listData?.length > 0 &&
        (this.editable || this.deletable || this.draggable))
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
    getInlineClass(item) {
      return this.inline && {
        'dito-inline-row': true,
        'dito-inline-bar': !this.getFormSchema(item).compact
      }
    }
  }
})
</script>
