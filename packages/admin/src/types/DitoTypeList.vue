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
      :listQuery="listQuery"
      :scopes="scopes"
    )
    //- When there's only pagination without scopes, we need a good ol' spacer
    //- div, for the layout not to break...
    .dito-spacer(
      v-else-if="hasPagination"
    )
    DitoPagination(
      v-if="hasPagination"
      :listQuery="listQuery"
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
      :listQuery="listQuery"
      :columns="columns"
      :hasEditButtons="hasEditButtons"
    )
    DitoDraggable(
      as="tbody"
      :options="getDraggableOptions()"
      :draggable="draggable"
      :modelValue="listData"
    )
      tr.dito-table__row(
        v-for="(item, index) in listData"
        :id="getComponentPath(index)"
        :key="getItemUid(schema, item)"
        :class="{ 'dito-table__row--error': dataModel.hasErrorsWithin(item) }"
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
              :formSchema="getItemFormSchema(schema, item, context)"
              :dataPath="getDataPath(index)"
              :data="item"
              :index="index"
              :store="getItemStore(item)"
              :disabled="disabled || isLoading"
              :collapsed="collapsed"
              :collapsible="collapsible"
              :deletable="deletable"
              :draggable="draggable && listData.length > 1"
              :editable="editable"
              :editPath="getEditPath(index)"
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
            :store="getItemStore(item)"
            :disabled="disabled || isLoading"
            :deletable="deletable"
            :draggable="draggable"
            :editable="editable"
            :editPath="getEditPath(index)"
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
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useSortable } from '../composables/useSortable.ts'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import SourceMixin, { useSourceServices } from '../mixins/SourceMixin.js'
import {
  resolveSchemaComponent,
  resolveSchemaComponents
} from '../utils/schema/setup.js'
import { createFiltersPanel, getFiltersDataErrors } from '../utils/filter.js'
import { appendDataPath } from '../utils/data.js'
import { hyphenate } from '@ditojs/utils'
import { computed, getCurrentInstance } from 'vue'

// @vue/component
const DitoTypeList = DitoComponent.component('DitoTypeList', {
  mixins: [SourceMixin],
  components: { DitoSourceItem },
  props: fieldProps,

  setup(props) {
    const { value, context, disabled, onChange, focus } = useField(props, {
      services: useSourceServices()
    })
    // `SourceMixin` holds the list of the items:
    const component = getCurrentInstance().proxy
    const { getDraggableOptions, moveItem } = useSortable({
      getListEntry: () => component.listEntry,
      onChange
    })
    return {
      value,
      context,
      disabled,
      onChange,
      focus,
      getDraggableOptions,
      moveItem
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

    getEditPath(index) {
      return this.editable ? this.getItemPath(index) : null
    },

    getCellClass(column) {
      return `dito-cell--${hyphenate(column.name)}`
    },

    onFilterErrors(errors) {
      const filtersDataPath = appendDataPath(this.dataPath, '$filters')
      const panel = this.schemaComponent.getPanelByDataPath(filtersDataPath)
      if (panel) {
        panel.mainSchemaComponent.showValidationErrors(
          getFiltersDataErrors(errors)
        )
        return true
      }
    }
  }
})

defineType({
  types: ['list'],
  component: DitoTypeList,
  ...sourceTraits,
  sourceType: 'list',

  getPanelSchema(api, schema, dataPath, source) {
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
            return source.listQuery.query
          },

          // The panel clears the page, but it's only reset when the filters
          // change the query, as the filtered list then has other pages.
          set({ page, ...query }) {
            source.listQuery.update(query, { resetPage: true })
          }
        })
      )
    }
  },

  async processSchema(api, schema, name) {
    await Promise.all([
      resolveSchemaComponent(schema),
      resolveSchemaComponents(schema.columns),
      sourceTraits.processSchema(api, schema, name)
    ])
  }
})

export default DitoTypeList
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
