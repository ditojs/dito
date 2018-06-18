<template lang="pug">
  .dito-list(
    :class="schema.class"
    :style="schema.style"
  )
    .dito-navigation(v-if="scopes || paginate")
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
    .dito-filters(
      v-if="filters"
    )
      .dito-filters-title
      form(
        @submit.prevent="applyFilters"
      )
        dito-schema.dito-filters-schema(
          ref="filtersSchema"
          :schema="filtersSchema"
          :data="filtersData"
          dataPath=""
          :meta="{}"
          :store="{}"
          :disabled="false"
          :generateLabels="true"
        )
          .dito-buttons(slot="buttons")
            button.dito-button.dito-button-clear(
              type="button"
              @click="clearFilters"
            )
            button.dito-button.dito-button-filter(
              type="submit"
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
          :class="{ 'dito-inline-row': inline }"
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
              dito-inline-schema(
                v-if="inline"
                :label="getItemLabel(item, index)"
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
                v-html="getItemLabel(item, index)"
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
    position: relative
    .dito-navigation
      display: flex
      justify-content: space-between
      padding-bottom: $content-padding-half
      margin-top: -$content-padding-half
      +user-select(none)
    // Inline Rows
    tr.dito-inline-row
      // Turn the rows into blocks, so we can add margins:
      display: block
      margin-bottom: $form-spacing
      // Only top-level inline rows (on white) should have margins
      tr.dito-inline-row
        margin-bottom: 0
    .dito-filters
      position: absolute
      left: $content-width + $content-padding
      min-width: 240px
      .dito-filters-title
        &::before
          content: 'Filters'
        height: 2em
        line-height: 2em
        padding: 0 $form-spacing
        background: $button-color
        border-radius: $border-radius
      .dito-filters-schema
        font-size: 11px
        margin-top: 1px
        background: $table-color-background
        border-radius: $border-radius
        padding: 0 $form-spacing
        tr.dito-inline-row
          // Clear trick above again, as it causes trouble on Chrome
          display: table-row
        td
          padding: 0
        .dito-label
          margin: 0
        .dito-components
          margin: 0 (-$form-spacing-half)
        .dito-component-container
          padding: $form-spacing-half
        .dito-buttons
          text-align: right
          padding: $form-spacing 0
</style>

<script>
import VueDraggable from 'vuedraggable'
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import OrderedMixin from '@/mixins/OrderedMixin'
import DateTimePicker from '@ditojs/ui/src/components/DateTimePicker'

export default TypeComponent.register([
  'list', 'object'
], {
  mixins: [SourceMixin, OrderedMixin],
  components: { VueDraggable, DateTimePicker },

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
    onFilterErrors(errors) {
      this.$refs.filtersSchema.showErrors(errors, true)
    }
  }
})
</script>
