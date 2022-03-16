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
      // When there's only pagination without scopes, we need a good ol' spacer
      // div, for the layout not to break...
      .dito-spacer(
        v-else-if="paginate"
      )
      dito-pagination(
        v-if="paginate"
        :query="query"
        :limit="paginate"
        :total="total || 0"
      )
    table.dito-table(
      :class=`{
        'dito-table-separators': isInlined,
        'dito-table-larger-padding': hasEditButtons && !isInlined,
        'dito-table-alternate-colors': !isInlined,
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
        :list="updateOrder(sourceSchema, listData, paginationRange)"
        @start="onStartDrag"
        @end="onEndDrag"
      )
        tr(
          v-for="item, index in listData"
          :key="getItemUid(schema, item)"
          :id="getDataPath(index)"
        )
          template(v-if="columns")
            dito-table-cell(
              v-for="column in columns"
              v-if="shouldRender(column)"
              :key="column.name"
              :class="getCellClass(column)"
              :cell="column"
              :schema="schema"
              :dataPath="getDataPath(index)"
              :data="item"
              :meta="nestedMeta"
              :store="store"
              :nested="false"
              :disabled="disabled || isLoading"
            )
          template(v-else)
            td
              dito-schema-inlined(
                v-if="isInlined"
                :label="getItemLabel(schema, item, { index, asObject: true })"
                :schema="getItemFormSchema(schema, item, context)"
                :dataPath="getDataPath(index)"
                :data="item"
                :meta="nestedMeta"
                :store="getChildStore(index)"
                :disabled="disabled || isLoading"
                :collapsed="collapsed"
                :collapsible="collapsible"
                :deletable="deletable"
                :draggable="draggable"
                :editable="editable"
                :editPath="getEditPath(item, index)"
                @delete="deleteItem(item, index)"
              )
              component(
                v-else-if="component"
                :is="component"
                :dataPath="getDataPath(index)"
                :data="item"
                :nested="false"
              )
              span(
                v-else-if="render"
                v-html="render(getContext(item, index))"
              )
              span(
                v-else
                v-html="getItemLabel(schema, item, { index })"
              )
          td.dito-cell-edit-buttons(
            v-if="hasCellEditButtons"
          )
            dito-edit-buttons(
              :deletable="deletable"
              :draggable="draggable"
              :editable="editable"
              :editPath="getEditPath(item, index)"
              :schema="getItemFormSchema(schema, item, context)"
              :dataPath="getDataPath(index)"
              :data="item"
              :meta="nestedMeta"
              :store="getChildStore(index)"
              @delete="deleteItem(item, index)"
            )
      // Render create buttons inside table when not in a single component view:
      tfoot(
        v-if="hasListButtons && !single"
      )
        tr
          td.dito-cell-edit-buttons(
            :colspan="numColumns"
          )
            dito-edit-buttons(
              :creatable="creatable"
              :createPath="path"
              :buttons="buttonSchemas"
              :schema="schema"
              :dataPath="dataPath"
              :data="listData"
              :meta="meta"
              :store="store"
            )
    // Render create buttons outside table when in a single component view:
    dito-edit-buttons.dito-buttons-main.dito-buttons-large(
      v-if="hasListButtons && single"
      :creatable="creatable"
      :createPath="path"
      :buttons="buttonSchemas"
      :schema="schema"
      :dataPath="dataPath"
      :data="listData"
      :meta="meta"
      :store="store"
    )
</template>

<style lang="sass">
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
    &.dito-single
      // So that list buttons can be sticky to the bottom:
      display: grid
      grid-template-rows: min-content
      height: 100%
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import DitoContext from '../DitoContext.js'
import SourceMixin from '../mixins/SourceMixin.js'
import OrderedMixin from '../mixins/OrderedMixin.js'
import VueDraggable from 'vuedraggable'
import { getNamedSchemas, getViewEditPath } from '../utils/schema.js'
import { getFiltersPanel } from '../utils/filter.js'
import { appendDataPath } from '../utils/data.js'
import { pickBy, equals, hyphenate } from '@ditojs/utils'

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
      const getListComponent = () => schemaComponent.getComponentByDataPath(
        dataPath,
        component => component.type === 'list'
      )

      return getFiltersPanel(
        getNamedSchemas(filters),
        dataPath,
        { // Create a simple proxy to get / set the query, see getFiltersPanel()
          get query() {
            return getListComponent()?.query
          },
          set query(query) {
            const component = getListComponent()
            if (component) {
              // Filter out undefined values for comparing with equals()
              const filter = obj => pickBy(obj, value => value !== undefined)
              if (!equals(filter(query), filter(component.query))) {
                component.query = query
                component.loadData(false)
              }
            }
          }
        }
      )
    }
  },

  computed: {
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
    },

    hasCellEditButtons() {
      return !this.isInlined && this.hasEditButtons
    },

    hasEvenCount() {
      return !(this.listData.length % 2)
    },

    numColumns() {
      return (
        (this.columns ? Object.keys(this.columns).length : 1) +
        (this.hasCellEditButtons ? 1 : 0)
      )
    }
  },

  methods: {
    getDataPath(index) {
      return appendDataPath(this.dataPath, index)
    },

    getEditPath(item, index) {
      if (this.editable) {
        const path = getViewEditPath(this.schema, this.context) || this.path
        const id = this.getItemId(this.schema, item, index)
        return `${path}/${id}`
      }
      return null
    },

    getCellClass(column) {
      return `dito-cell-${hyphenate(column.name)}`
    },

    getContext(item, index) {
      return new DitoContext(this, {
        data: item,
        value: item,
        index,
        dataPath: this.getDataPath(index)
      })
    },

    onFilterErrors(errors) {
      const filtersDataPath = appendDataPath(this.dataPath, '$filters')
      const panel = this.schemaComponent.getPanelByDataPath(filtersDataPath)
      if (panel) {
        panel.showValidationErrors(errors, true)
        return true
      }
    }
  }
})
</script>
