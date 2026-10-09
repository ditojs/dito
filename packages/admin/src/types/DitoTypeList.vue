<template lang="pug">
.dito-list(
  v-if="isReady"
  :id="componentPath"
  role="region"
  :aria-label="label || labelize(schema.name)"
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
      'dito-table--separators': isInlined,
      'dito-table--larger-padding': hasEditButtons && !isInlined,
      'dito-table--alternate-colors': !isInlined,
      'dito-table--even-count': hasEvenCount
    }`
  )
    DitoTableHead(
      v-if="columns"
      :query="query"
      :columns="columns"
      :hasEditButtons="hasEditButtons"
    )
    DitoDraggable(
      as="tbody"
      :options="getDraggableOptions()"
      :draggable="draggable"
      :modelValue="listData"
      @update:modelValue="value => (listData = value)"
    )
      tr(
        v-for="(item, index) in listData"
        :id="getComponentPath(index)"
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
            DitoSourceItem(
              :schema="schema"
              :dataPath="getDataPath(index)"
              :data="item"
              :index="index"
              :meta="nestedMeta"
              :store="getItemStore(item)"
              :disabled="disabled || isLoading"
              :collapsed="collapsed"
              :collapsible="collapsible"
              :deletable="deletable"
              :draggable="draggable && listData.length > 1"
              :editable="editable"
              :editPath="getEditPath(item, index)"
              :createPath="createPath"
              :insertIndex="creatable && draggable ? index : null"
              @delete="deleteItem(item, index)"
              @move="delta => moveItem(item, delta)"
            )
        td.dito-table__buttons(
          v-if="hasCellEditButtons"
        )
          DitoEditButtons(
            nested
            :schema="schema"
            :formSchema="getItemFormSchema(schema, item, context)"
            :dataPath="getDataPath(index)"
            :data="item"
            :meta="nestedMeta"
            :store="getItemStore(item)"
            :disabled="disabled || isLoading"
            :deletable="deletable"
            :draggable="draggable"
            :editable="editable"
            :editPath="getEditPath(item, index)"
            @delete="deleteItem(item, index)"
            @move="delta => moveItem(item, delta)"
          )
    //- Render the list buttons inside the table when not in a single
    //- component view, with the item that holds the list as their data:
    tfoot(
      v-if="hasListButtons && !single"
    )
      tr
        td.dito-table__buttons(:colspan="numColumns")
          DitoEditButtons(
            v-bind="listButtonsAttributes"
            :data="data"
          )
  //- ...and outside, sticky to the bottom, when in a single component view,
  //- with the list data as their data, e.g. for buttons that store its order:
  DitoEditButtons.dito-buttons--large.dito-buttons--main.dito-buttons--sticky(
    v-if="hasListButtons && single"
    v-bind="listButtonsAttributes"
    :data="listData"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import SourceMixin from '../mixins/SourceMixin.js'
import SortableMixin from '../mixins/SortableMixin.js'
import {
  resolveSchemaComponent,
  resolveSchemaComponents
} from '../utils/schema/setup.js'
import { getViewEditPath } from '../utils/schema/lookup.js'
import { createFiltersPanel } from '../utils/filter.js'
import { appendDataPath } from '../utils/data.js'
import { getListWithMovedItem } from '../utils/list.js'
import { hyphenate } from '@ditojs/utils'
import { computed } from 'vue'

// @vue/component
export default DitoTypeComponent.register('list', {
  mixins: [SourceMixin, SortableMixin],
  components: { DitoSourceItem },

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
        // Pass a computed value to get / set the query, see
        // `createFiltersPanel()`.
        computed({
          get() {
            return component.query
          },

          // The panel clears the page, but it's only reset when the filters
          // change the query, as the filtered list then has other pages.
          set({ page, ...query }) {
            component.listQuery.update(query, { resetPage: true })
          }
        })
      )
    }
  },

  computed: {
    hasPagination() {
      return !!this.paginate
    },

    hasListButtons() {
      return !!(this.buttonSchemas || this.creatable)
    },

    listButtonsAttributes() {
      return {
        buttons: this.buttonSchemas,
        schema: this.schema,
        dataPath: this.dataPath,
        meta: this.meta,
        store: this.store,
        nested: this.nested,
        disabled: this.disabled || this.isLoading,
        creatable: this.creatable,
        createPath: this.createPath
      }
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

    getComponentPath(index) {
      return appendDataPath(this.componentPath, index)
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

    // Moves the item by `delta` positions, see `DitoDragHandle`.
    moveItem(item, delta) {
      const listData = getListWithMovedItem(this.listData, item, delta)
      if (listData) {
        this.listData = listData
        this.onChange()
      }
    },

    getCellClass(column) {
      return `dito-cell--${hyphenate(column.name)}`
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

  &.dito-component--single {
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
