<template lang="pug">
  .dito-list(
    :id="getDataPath()"
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
    table.dito-table.dito-anchor(
      :class="{ 'dito-table-spaced': hasSpacing }"
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
              dito-schema-inline(
                v-if="inline"
                :label="isListSource ? getItemLabel(schema, item, index) : null"
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
                v-html="renderItem(item, index)"
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
      tfoot(v-if="creatable && !hasCreateButton")
        tr
          td.dito-buttons.dito-buttons-round(:colspan="numColumns")
            dito-form-chooser(
              :schema="schema"
              :path="path"
              :verb="verbs.create"
            )
    .dito-buttons.dito-form-buttons(v-if="hasCreateButton")
      dito-form-chooser(
        :schema="schema"
        :path="path"
        :verb="verbs.create"
        :text="`Create ${getLabel(schema.form)}`"
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
    margin-top: -$form-spacing
</style>

<script>
import VueDraggable from 'vuedraggable'
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import OrderedMixin from '@/mixins/OrderedMixin'
import { DateTimePicker } from '@ditojs/ui'
import { pickBy, equals, hyphenate } from '@ditojs/utils'
import { getNamedSchemas } from '@/utils/schema'
import { getFiltersPanel } from '@/utils/filter'
import { appendDataPath } from '@/utils/data'

// @vue/component
export default TypeComponent.register([
  'list', 'object'
], {
  mixins: [SourceMixin, OrderedMixin],
  components: { VueDraggable, DateTimePicker },

  getSourceType(type) {
    // No need for transformation here. See TypeTreeList for details.
    return type
  },

  getPanelSchema(schema, dataPath, schemaComponent) {
    const { filters } = schema
    // See if this list component wants to display a filter panel, and if so,
    // create the panel schema for it through `getFiltersPanel()`.
    if (filters) {
      // At the time of the creation of the panel schema, the schemaComponent is
      // not filled yet, so we can't get the target component (dataPath) right
      // away. Use a proxy and a getter instead, to get around this:
      const getComponent = () => schemaComponent.getComponent(dataPath)

      return getFiltersPanel(
        getNamedSchemas(filters),
        dataPath,
        { // Create a simple proxy to get / set the query, see getFiltersPanel()
          get query() {
            return getComponent()?.query
          },
          set query(query) {
            const comp = getComponent()
            if (comp) {
              // Filter out undefined values for comparing with equals()
              const filter = obj => pickBy(obj, value => value !== undefined)
              if (!equals(filter(query), filter(comp.query))) {
                comp.query = query
                comp.loadData(false)
              }
            }
          }
        }
      )
    }
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
    },

    hasCreateButton() {
      const { schema } = this
      return this.creatable && (schema.form && !schema.nested)
    }
  },

  methods: {
    getCellClass(cell) {
      return `dito-cell-${hyphenate(cell.name)}`
    },

    onFilterErrors(errors) {
      // TODO: Fix this properly in requestData(): When loading the full admin
      // with a filter and there's an error, the panel doesn't get positioned:
      this.schemaComponent.onLayout()
      const filtersDataPath = appendDataPath(this.dataPath, '$filters')
      // TODO: Consider registering schemas separately instead and make them
      // available through `getSchema(dataPath)`?
      const filtersPanel = this.schemaComponent.getComponent(filtersDataPath)
      filtersPanel.showErrors(errors, true)
    }
  }
})
</script>
