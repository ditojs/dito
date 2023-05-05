<template lang="pug">
.dito-list(
  v-if="isReady"
  :id="dataPath"
)
  .dito-list__header(
    v-if="scopes || hasPagination"
  )
    DitoScopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    //- When there's only pagination without scopes, we need a good ol' spacer
    //- div, for the layout not to break...
    .dito-spacer(
      v-else-if="hasPagination"
    )
    DitoPagination(
      v-if="hasPagination"
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
    DitoTableHead(
      v-if="columns"
      :query="query"
      :columns="columns"
      :hasEditButtons="hasEditButtons"
    )
    DitoDraggable(
      tag="tbody"
      :modelValue="updateOrder(sourceSchema, listData, paginationRange)"
      :options="getSortableOptions(false)"
      :draggable="draggable"
      @update:modelValue="value => (listData = value)"
    )
      tr(
        v-for="(item, index) in listData"
        :id="getDataPath(index)"
        :key="getItemUid(schema, item)"
      )
        template(
          v-if="columns"
        )
          template(
            v-for="column in columns"
          )
            DitoTableCell(
              v-if="shouldRenderSchema(column)"
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
        template(
          v-else
        )
          td
            DitoSchemaInlined(
              v-if="isInlined"
              :label="getItemLabel(schema, item, { index, asObject: true })"
              :schema="getItemFormSchema(schema, item, context)"
              :dataPath="getDataPath(index)"
              :data="item"
              :meta="nestedMeta"
              :store="getChildStore(getItemUid(schema, item), index)"
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
              v-else-if="schema.component"
              :is="schema.component"
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
          DitoEditButtons(
            :deletable="deletable"
            :draggable="draggable"
            :editable="editable"
            :editPath="getEditPath(item, index)"
            :schema="getItemFormSchema(schema, item, context)"
            :dataPath="getDataPath(index)"
            :data="item"
            :meta="nestedMeta"
            :store="getChildStore(getItemUid(schema, item), index)"
            @delete="deleteItem(item, index)"
          )
    //- Render create buttons inside table when not in a single component view:
    tfoot(
      v-if="hasListButtons && !single"
    )
      tr
        td.dito-cell-edit-buttons(:colspan="numColumns")
          DitoEditButtons(
            :creatable="creatable"
            :createPath="path"
            :buttons="buttonSchemas"
            :schema="schema"
            :dataPath="dataPath"
            :data="listData"
            :meta="meta"
            :store="store"
          )
  //- Render create buttons outside table when in a single component view:
  DitoEditButtons.dito-buttons-main.dito-buttons-large(
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

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoContext from '../DitoContext.js'
import SourceMixin from '../mixins/SourceMixin.js'
import SortableMixin from '../mixins/SortableMixin.js'
import {
  getViewEditPath,
  resolveSchemaComponent,
  resolveSchemaComponents
} from '../utils/schema.js'
import { createFiltersPanel } from '../utils/filter.js'
import { appendDataPath } from '../utils/data.js'
import { pickBy, equals, hyphenate } from '@ditojs/utils'
import { computed } from 'vue'

// @vue/component
export default DitoTypeComponent.register('list', {
  mixins: [SourceMixin, SortableMixin],

  getSourceType(type) {
    // No need for transformation here. See TypeTreeList for details.
    return type
  },

  getPanelSchema(api, schema, dataPath, component) {
    const { filters } = schema
    // See if this list component wants to display a filter panel, and if so,
    // create the panel schema for it through `getFiltersPanel()`.
    if (filters) {
      return createFiltersPanel(
        api,
        filters,
        dataPath,
        // Pass a computed value to get / set the query, see getFiltersPanel()
        computed({
          get() {
            return component.query
          },

          set(query) {
            // Filter out undefined values for comparing with equals()
            const filter = obj => pickBy(obj, value => value !== undefined)
            if (!equals(filter(query), filter(component.query))) {
              component.query = query
              component.loadData(false)
            }
          }
        })
      )
    }
  },

  computed: {
    hasPagination() {
      return this.paginate && this.total > this.paginate
    },

    hasListButtons() {
      return !!(this.buttonSchemas || this.creatable)
    },

    hasEditButtons() {
      const { listData } = this
      return (
        listData.length > 0 && (
          this.editable ||
          this.deletable ||
          this.draggable
        )
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
        const id = this.getItemId(this.schema, item, index)
        return (
          getViewEditPath(this.schema, id, this.context) ||
          `${this.path}/${id}`
        )
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
  },

  async processSchema(
    api,
    schema,
    name,
    routes,
    level,
    nested = false,
    flatten = false,
    process = null
  ) {
    await Promise.all([
      resolveSchemaComponent(schema),
      resolveSchemaComponents(schema.columns),
      SourceMixin.processSchema(
        api,
        schema,
        name,
        routes,
        level,
        nested,
        flatten,
        process
      )
    ])
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-list {
  $self: &;

  position: relative;

  &__header {
    display: flex;
    justify-content: space-between;
    padding-bottom: $content-padding-half;
    @include user-select(none);

    &:empty {
      display: none;
    }

    .dito-scopes,
    .dito-pagination {
      display: flex;
      flex: 0 1 auto;
      min-width: 0;
    }
  }

  &.dito-single {
    // So that list buttons can be sticky to the bottom:
    display: grid;
    grid-template-rows: min-content;
    height: 100%;

    // Make single list header, navigation and buttons sticky to the top and
    // bottom:
    #{$self}__header {
      position: sticky;
      top: 0;
      margin-top: -$content-padding;
      padding-top: $content-padding;
      background: $content-color-background;
      z-index: 1;

      + .dito-table {
        .dito-table-head {
          position: sticky;
          top: calc($input-height + $content-padding + $content-padding-half);
          background: $content-color-background;
          z-index: 1;
        }
      }
    }
  }
}
</style>
