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
    table.dito-table
      dito-list-head(
        v-if="columns"
        :query="query"
        :columns="columns"
        :hasButtons="hasButtons"
      )
      vue-draggable(
        element="tbody"
        :list="listData"
        :options="getDragOptions(draggable)"
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
              v-for="cell in columns"
              :key="cell.name"
              :cell="cell"
              :schema="schema"
              :dataPath="getDataPath(index)"
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
                :dataPath="getDataPath(index)"
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
              :to="getEditLink(item, index)" append
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
  // Inline Rows
  tr.dito-inline-row
    display: block
    margin-bottom: $form-spacing
    tr.dito-inline-row
      margin-bottom: 0
    &.dito-inline-bar
      position: relative
      // Only style the td and .dito-buttons elements directly in this
      // .dito-inline-bar, not further nested ones:
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

export default TypeComponent.register([
  'list', 'object'
], {
  mixins: [SourceMixin, OrderedMixin],
  components: { VueDraggable },

  getSourceType(type) {
    // No need for transformation here. See TypeTreeList for details.
    return type
  },

  computed: {
    numColumns() {
      return (this.columns ? Object.keys(this.columns).length : 1) +
        (this.creatable ? 1 : 0)
    },

    hasButtons() {
      const { listData } = this
      return listData.length > 0 &&
        (this.editable || this.deletable || this.draggable)
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
