<template lang="pug">
  .dito-list(
    :class="schema.class"
    :style="schema.style"
  )
    .dito-navigation
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
    dito-filters(
      v-if="filters"
      ref="filters"
      :filters="filters"
      :query="query"
    )
    table.dito-table(
      :class="{ 'dito-table-spaced': hasSpacing }"
      :id="getDataPath()"
    )
      dito-table-head(
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
          :key="getItemId(schema, item, index)"
          :id="getDataPath(index)"
        )
          template(v-if="columns")
            dito-table-cell(
              v-for="cell in columns"
              :key="cell.name"
              :class="getCellClass(cell)"
              :cell="cell"
              :schema="schema"
              :dataPath="getDataPath(index)"
              :dataPathIsValue="false"
              :data="item"
              :meta="nestedMeta"
              :store="store"
              :disabled="disabled || isLoading"
            )
          template(v-else)
            td
              dito-inline-schema(
                v-if="inline"
                :label="getItemLabel(schema, item, index)"
                :schema="getItemFormSchema(schema, item)"
                :dataPath="getDataPath(index)"
                :data="item"
                :meta="nestedMeta"
                :store="store"
                :disabled="disabled || isLoading"
              )
              component(
                v-else-if="component"
                :is="component"
                :dataPath="getDataPath(index)"
                :dataPathIsValue="false"
                :data="item"
              )
              span(
                v-else-if="schema.render"
                v-html="schema.render(item)"
              )
              span(
                v-else
                v-html="getItemLabel(schema, item, index)"
              )
          td.dito-buttons.dito-buttons-round(v-if="hasButtons")
            button.dito-button(
              v-if="draggable"
              type="button"
              v-bind="getButtonAttributes(verbs.drag)"
            )
            router-link.dito-button(
              v-if="editable"
              :to="getEditLink(item, index)" append
              tag="button"
              type="button"
              v-bind="getButtonAttributes(verbs.edit)"
            )
            button.dito-button(
              v-if="deletable"
              type="button"
              @click="deleteItem(item, index)"
              v-bind="getButtonAttributes(verbs.delete)"
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
    position: relative
    .dito-navigation
      display: flex
      justify-content: space-between
      padding-bottom: $content-padding-half
      margin-top: -$content-padding-half
      +user-select(none)
      &:empty
        display: none
  .dito-table-spaced
    border-spacing: 0 $form-spacing
</style>

<script>
import VueDraggable from 'vuedraggable'
import DitoTypeComponent from '@/DitoTypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import OrderedMixin from '@/mixins/OrderedMixin'
import { DateTimePicker } from '@ditojs/ui'
import { hyphenate } from '@ditojs/utils'

// @vue/component
export default DitoTypeComponent.register([
  'list', 'object'
], {
  mixins: [SourceMixin, OrderedMixin],
  components: { VueDraggable, DateTimePicker },

  getSourceType(type) {
    // No need for transformation here. See DitoTreeList for details.
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
    },

    hasSpacing() {
      return this.isListSource && this.inline &&
        // If there are only compact forms with no labels, don't add spacing
        (!this.isCompact || this.hasLabels)
    }
  },

  methods: {
    getCellClass(cell) {
      return `dito-cell-${hyphenate(cell.name)}`
    },

    onFilterErrors(errors) {
      this.$refs.filters.showErrors(errors, true)
    }
  }
})
</script>
