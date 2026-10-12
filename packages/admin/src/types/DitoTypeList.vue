<template lang="pug">
.dito-list(
  v-if="isReady"
  :id="componentPath"
  ref="element"
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
      :context="context"
    )
    //- Pagination without scopes needs a spacer for the layout:
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
      :context="context"
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
              :createPath="sourceContext.createPath"
              :insertIndex="creatable && draggable ? index : null"
              @delete="deleteItem(item, index)"
              @move="delta => moveItem(index, delta)"
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
            @move="delta => moveItem(index, delta)"
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
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps } from '../composables/useField.ts'
import { useSource } from '../composables/useSource.ts'
import { useSortable } from '../composables/useSortable.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import {
  resolveSchemaComponent,
  resolveSchemaComponents
} from '../utils/schema/setup.js'
import { createFiltersPanel, getFiltersDataErrors } from '../utils/filter.js'
import { appendDataPath } from '../utils/data.js'
import { getItemUid } from '../utils/schema/data.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { hyphenate, labelize } from '@ditojs/utils'
import { computed } from 'vue'

// @vue/component
const DitoTypeList = {
  components: { DitoSourceItem },
  props: fieldProps,

  setup(props) {
    const source = useSource(props, {
      onFilterErrors(errors) {
        // The filters panel is its own container:
        const [panel] = source.services.adminContext.ui.getHandles(
          appendDataPath(source.componentPath.value, '$filters')
        )
        panel?.dataContext.showValidationErrors(getFiltersDataErrors(errors))
        return !!panel
      }
    })
    const { getDraggableOptions, moveItem } = useSortable({
      getListEntry: () => source.listEntry.value,
      onChange: source.onChange
    })
    const { listData, editable, deletable, draggable, creatable } = source
    const hasListButtons = computed(
      () => !!(source.buttonSchemas.value || creatable.value)
    )
    const hasEditButtons = computed(
      () => (
        listData.value.length > 0 &&
        (editable.value || deletable.value || draggable.value)
      )
    )
    const hasCellEditButtons = computed(
      () => !source.isInlined.value && hasEditButtons.value
    )

    return {
      ...source,
      shouldRenderSchema: useSchemaValue(source.context).shouldRenderSchema,
      labelize,
      getItemUid,
      getItemFormSchema,
      getDraggableOptions,
      moveItem,
      hasListButtons,
      hasEditButtons,
      hasCellEditButtons,
      dataModel: computed(() => source.services.dataContext.model),
      hasPagination: computed(() => !!source.paginate.value),
      hasEvenCount: computed(() => !(listData.value.length % 2)),

      numColumns: computed(() => {
        const columns = source.columns.value
        return (
          (columns ? Object.keys(columns).length : 1) +
          (hasCellEditButtons.value ? 1 : 0)
        )
      }),

      listButtonsAttributes: computed(() => ({
        buttons: source.buttonSchemas.value,
        schema: props.schema,
        dataPath: props.dataPath,
        store: props.store,
        nested: props.nested,
        disabled: source.disabled.value || source.isLoading.value,
        creatable: creatable.value,
        createPath: source.sourceContext.createPath
      })),

      getDataPath(index) {
        return appendDataPath(props.dataPath, index)
      },

      getComponentPath(index) {
        return appendDataPath(source.componentPath.value, index)
      },

      getEditPath(index) {
        return editable.value ? source.sourceContext.getItemPath(index) : null
      },

      getCellClass(column) {
        return `dito-cell--${hyphenate(column.name)}`
      }
    }
  }
}

defineType({
  type: 'list',
  component: DitoTypeList,
  ...sourceTraits,
  sourceType: 'list',

  getPanelSchema(api, schema, dataPath, source) {
    const { filters } = schema
    if (filters) {
      return createFiltersPanel(
        api,
        filters,
        dataPath,
        computed({
          get() {
            return source.listQuery.query
          },

          // Only reset the page that the panel clears when the query changes:
          set({ page, ...query }) {
            source.listQuery.update(query, { resetPage: true })
          }
        })
      )
    }
  },

  async setupSchema(api, schema, name) {
    await Promise.all([
      resolveSchemaComponent(schema),
      resolveSchemaComponents(schema.columns),
      sourceTraits.setupSchema(api, schema, name)
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
