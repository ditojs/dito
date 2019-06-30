<template lang="pug">
  .dito-list(
    v-if="isReady"
    :id="dataPath"
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
    table.dito-table(
      :class=`{
        'dito-table-separators': hasSeparators,
        'dito-table-alternate-colors': !hasSeparators,
        'dito-table-even-count': hasEvenCount
      }`
    )
      dito-table-head(
        v-if="columns"
        :query="query"
        :columns="columns"
        :hasEditButtons="hasEditButtons"
      )
      vue-draggable(
        tag="tbody"
        v-bind="getDragOptions(draggable)"
        :list="updateOrder(listData, schema)"
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
              dito-schema-inlined(
                v-if="inlined"
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
                v-html="schema.render(getItemParams(item, index))"
              )
              span(
                v-else
                v-html="getItemLabel(schema, item, index)"
              )
          td.dito-buttons.dito-buttons-round(v-if="hasEditButtons")
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
      // Render create button inside the table if we're not inside a single
      // component view:
      tfoot(
        v-if="hasListButtons && !isInSingleComponentView"
      )
        tr
          dito-buttons.dito-buttons-round(
            tag="td"
            :buttons="buttonSchemas"
            :dataPath="dataPath"
            :data="listData"
            :meta="meta"
            :colspan="numColumns"
          )
            dito-create-button(
              v-if="creatable"
              :schema="schema"
              :path="path"
              :verb="verbs.create"
              :text="createButtonText"
            )
    // Render create button outside the table if we're inside a single
    // component view:
    dito-buttons.dito-buttons-large(
      v-if="hasListButtons && isInSingleComponentView"
      :buttons="buttonSchemas"
      :dataPath="dataPath"
      :data="listData"
      :meta="meta"
    )
      dito-create-button(
        v-if="creatable"
        :schema="schema"
        :path="path"
        :verb="verbs.create"
        :text="createButtonText"
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
      +user-select(none)
      &:empty
        display: none
      .dito-scopes,
      .dito-pagination
        display: flex
        flex: 0 1 auto
        min-width: 0
</style>

<script>
import VueDraggable from 'vuedraggable'
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import OrderedMixin from '@/mixins/OrderedMixin'
import { pickBy, equals, hyphenate } from '@ditojs/utils'
import { getNamedSchemas } from '@/utils/schema'
import { getFiltersPanel } from '@/utils/filter'
import { getItemParams, appendDataPath } from '@/utils/data'

// @vue/component
export default TypeComponent.register('list', {
  components: { VueDraggable },
  mixins: [SourceMixin, OrderedMixin],

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
        schemaComponent.api,
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
      return (
        (this.columns ? Object.keys(this.columns).length : 1) +
        (this.creatable ? 1 : 0)
      )
    },

    hasSeparators() {
      return this.inlined
    },

    hasListButtons() {
      return !!(
        this.buttonSchemas ||
        this.creatable
      )
    },

    hasEditButtons() {
      const { listData } = this
      return listData.length > 0 && (
        this.editable ||
        this.deletable ||
        this.draggable
      )
    }
  },

  methods: {
    getDataPath(index) {
      return appendDataPath(this.dataPath, index)
    },

    getEditLink(item, index) {
      return {
        path: this.isObjectSource
          ? this.path
          : `${this.path}/${this.getItemId(this.schema, item, index)}`
      }
    },

    getCellClass(cell) {
      return `dito-cell-${hyphenate(cell.name)}`
    },

    getItemParams(item, index) {
      return getItemParams(this, {
        name: undefined,
        value: undefined,
        data: item,
        dataPath: this.getDataPath(index)
      })
    },

    onFilterErrors(errors) {
      const filtersDataPath = appendDataPath(this.dataPath, '$filters')
      const filtersPanel = this.schemaComponent.getPanel(filtersDataPath)
      if (filtersPanel) {
        filtersPanel.showValidationErrors(errors, true)
        return true
      }
    }
  }
})
</script>
