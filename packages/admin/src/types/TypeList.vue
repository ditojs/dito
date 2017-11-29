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
            // TODO: Implement inline components in column mode!
            td(
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
                v-html="getItemTitle(item)"
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
    .dito-buttons.dito-buttons-round(v-if="creatable")
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
    .dito-filters
      overflow: auto
      padding-bottom: $form-margin / 2
      margin-top: -$form-margin / 2
      +user-select(none)
      .dito-scopes
        float: left
      .dito-pagination
        float: right
    > table
      width: 100%
      border-spacing: 0
      &:not(:empty)
        margin: -$list-spacing 0
        & + .dito-buttons
          margin-top: $list-spacing
      > tbody
        > tr
          vertical-align: baseline
          > td
            border-top: 1px solid $color-white
            padding: $form-spacing
            background: $color-lightest
            & + td
              border-left: 1px solid $color-white
            &.dito-buttons
              width: 1%
              padding: $buttons-padding
            &,
            &.dito-buttons // So it's stronger than .dito-buttons setting below.
              border-radius: 0
              // Add rounded corners in first & last headers.
              &:first-child
                border-top-left-radius: $border-radius
                border-bottom-left-radius: $border-radius
              &:last-child
                border-top-right-radius: $border-radius
                border-bottom-right-radius: $border-radius
    .dito-buttons
      vertical-align: top
      text-align: right
      padding: $buttons-padding
      background: $color-lightest
      border-radius: $border-radius
      border-top: 1px solid $color-white
      line-height: 1em
      .dito-button-drag
        cursor: grab
        &:active,
          cursor: grabbing
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
