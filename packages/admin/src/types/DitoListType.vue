<template lang="pug">
.dito-list(
  v-if="isReady"
  :id="componentPath"
  ref="element"
  role="region"
  :aria-label="labelText || labelize(schema.name)"
)
  //- Without a label, the buttons show in the header, which is otherwise
  //- empty and hidden:
  .dito-list__header(
    v-if=`
      scopes || hasPagination || hasClipboard || columnItems.length > 0 ||
      hasToggleAll && !labelId
    `
  )
    //- With a label, the label toggles all items:
    button.dito-chevron.dito-chevron--double(
      v-if="hasToggleAll && !labelId"
      type="button"
      :class="{ 'dito-chevron--open': !hasCollapsedItems }"
      :title="toggleAllTitle"
      :aria-label="toggleAllTitle"
      :aria-expanded="!hasCollapsedItems"
      @click="toggleAll"
    )
    DitoScopes.dito-list__scopes(
      v-if="scopes"
      :listQuery="listQuery"
      :scopes="scopes"
      :context="context"
    )
    DitoLabelButtons(
      v-if="hasClipboard"
      :labelId="labelId"
    )
      DitoClipboard(
        :clipboard="schema.clipboard"
        :name="clipboardName"
        :label="labelText"
        type="list"
        :hasData="listData.length > 0"
        :getData="getClipboardData"
        :getUploadEntries="getClipboardUploadEntries"
        :createContext="createContext"
        :disabled="!creatable || disabled || readonly || isLoading"
        @paste="pasteItems"
      )
    //- In an element of its own, as the menu renders next to its button:
    .dito-list__columns(
      v-if="columnItems.length > 0"
    )
      DitoMenuButton(
        :items="columnItems"
        align="end"
        @select="item => table.getColumn(item.value).toggleVisibility()"
      ) Columns
    DitoPagination.dito-list__pagination(
      v-if="hasPagination"
      v-model:page="page"
      :pageSize="paginate"
      :total="total || 0"
    )
  .dito-list__table
    table.dito-table(
      :class=`{
        'dito-table--separators': isInlined,
        'dito-table--larger-padding': hasEditButtons && !isInlined,
        'dito-table--alternate-colors': !isInlined,
        'dito-table--even-count': hasEvenCount,
        'dito-table--sized': hasSizedColumns
      }`
    )
      DitoTableHead.dito-list__table-head(
        v-if="columns"
        :table="table"
        :context="context"
      )
      DitoDraggable(
        as="tbody"
        :options="getDraggableOptions()"
        :draggable="draggable"
        :modelValue="listData"
      )
        template(
          v-for="{ row, item, index } in rows"
          :key="row.id"
        )
          tr.dito-table__row(
            :id="getComponentPath(index)"
            :class=`{
              'dito-table__row--error': dataModel.errors.hasWithin(item)
            }`
          )
            template(
              v-for="{ id, column } in row.getVisibleCells()"
              :key="id"
            )
              td.dito-table__expand(
                v-if="column.id === expandColumnId"
                :style="getColumnStyle(column)"
              )
                button.dito-chevron(
                  type="button"
                  :class="{ 'dito-chevron--open': row.getIsExpanded() }"
                  :aria-expanded="row.getIsExpanded()"
                  aria-label="Preview"
                  @click="row.toggleExpanded()"
                )
              td.dito-table__buttons(
                v-else-if="column.id === buttonsColumnId"
              )
                DitoEditButtons(
                  :schema="schema"
                  :formSchema="getItemFormSchema(schema, item, context)"
                  :dataPath="getDataPath(index)"
                  :data="item"
                  :store="getItemStore(item, index)"
                  :disabled="disabled || isLoading"
                  :deletable="deletable"
                  :draggable="draggable"
                  :editable="editable"
                  :editPath="getEditPath(index)"
                  @delete="deleteItem(item, index)"
                  @move="delta => moveItem(index, delta)"
                )
              td(
                v-else-if="column.id === itemColumnId"
              )
                DitoSourceItem(
                  :schema="schema"
                  :formSchema="getItemFormSchema(schema, item, context)"
                  :dataPath="getDataPath(index)"
                  :data="item"
                  :index="index"
                  :store="getItemStore(item, index)"
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
                  template(
                    v-if="$slots.default"
                    #default="{ context }"
                  )
                    slot(:context="context")
              DitoTableCell(
                v-else
                :class="getCellClass(column)"
                :style="getColumnStyle(column)"
                :cell="column.columnDef.meta.schema"
                :schema="schema"
                :dataPath="getDataPath(index)"
                :data="item"
                :store="store"
                :nested="false"
                :disabled="disabled || isLoading"
              )
          tr.dito-table__preview(
            v-if="hasPreview && row.getIsExpanded()"
          )
            td(:colspan="numColumns")
              .dito-table__preview-content(
                v-html="getPreviewHtml(item, index)"
              )
        tr.dito-table__row.dito-table__row--empty(
          v-if="emptyText && !listData.length && !isLoading"
        )
          td(:colspan="numColumns") {{ emptyText }}
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
  //- ...and outside, at the bottom, when in a single component view,
  //- with the list data as their item, e.g. for buttons that store its order:
  DitoEditButtons.dito-list__buttons.dito-buttons--large(
    v-if="hasListButtons && single"
    :class="['dito-buttons--main', 'dito-buttons--sticky']"
    v-bind="listButtonsAttributes"
    :data="listData"
    :itemDataPath="dataPath"
  )
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps } from '../composables/useField.ts'
import { useSource } from '../composables/useSource.ts'
import { useSortable } from '../composables/useSortable.ts'
import { useRenderedItems } from '../composables/useRenderedItems.ts'
import {
  useListTable,
  getColumnStyle,
  itemColumnId,
  buttonsColumnId,
  expandColumnId
} from '../composables/useListTable.ts'
import { useSteps, countStepItems } from '../composables/useSteps.ts'
import { provideToNode } from '../composables/useComponentPath.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import DitoSourceItem from '../components/DitoSourceItem.vue'
import DitoClipboard from '../components/DitoClipboard.vue'
import DitoLabelButtons from '../components/DitoLabelButtons.vue'
import {
  resolveSchemaComponent,
  resolveSchemaComponents
} from '../utils/schema/setup.js'
import { createFiltersPanel, getFiltersDataErrors } from '../utils/filter.js'
import { appendDataPath } from '../utils/data.js'
import { getHtml } from '../utils/html.js'
import { initializeData } from '../utils/schema/data.js'
import {
  getFormSchemas,
  getItemFormSchema,
  getItemFormSchemaFromForms
} from '../utils/schema/lookup.js'
import { isSourceWithResource } from '../utils/schema/structure.js'
import { walkData } from '../utils/schema/walk.js'
import { getClipboardName } from '../utils/clipboard.js'
import { fromClipboard } from '../utils/fromClipboard.ts'
import { toClipboard } from '../utils/toClipboard.ts'
import { getUploadEntries } from '../utils/interchange.ts'
import { labelToggleKey } from '../utils/keys.ts'
import { DitoMenuButton, DitoPagination } from '@ditojs/ui/src'
import { hyphenate, labelize } from '@ditojs/utils'
import { computed, inject, watchEffect } from 'vue'

// @vue/component
const DitoListType = {
  components: {
    DitoSourceItem,
    DitoClipboard,
    DitoLabelButtons,
    DitoMenuButton,
    DitoPagination
  },
  props: fieldProps,

  setup(props) {
    const source = useSource(props, {
      onFilterErrors(errors) {
        // The filters panel holds its own data:
        const { dataContext } = source.node.value.getNode('$filters').mounted
        dataContext?.showValidationErrors(getFiltersDataErrors(errors))
        return !!dataContext
      }
    })
    const { getDraggableOptions, moveItem } = useSortable({
      getListEntry: () => source.listEntry.value,
      onChange: source.onChange
    })
    const { listData, editable, deletable, draggable, creatable } = source
    const { services, context, getItemStore } = source
    const { getSchemaValue, getLabelText, shouldRenderSchema } =
      useSchemaValue(context)
    // The inlined schemas of the items read whether they're open from their
    // stores, which the table's expansion reads too:
    // Lists with columns can show previews of their items below their rows:
    const hasPreview = computed(
      () => !!props.schema.preview && !source.isInlined.value
    )
    const isItemOpen = (item, index) => (
      getItemStore(item, index).opened ??
      !(source.collapsed.value || hasPreview.value)
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
    const table = useListTable({
      schema: props.schema,
      store: props.store,
      items: listData,
      columns: source.columns,
      listQuery: source.listQuery,
      hasButtons: hasCellEditButtons,
      hasPreview,
      expandable: computed(() => source.collapsible.value || hasPreview.value),
      isItemOpen,
      getItemStore,
      shouldRenderSchema
    })
    // Steps render items by the fields of their forms. Collapsed items render
    // only their header, and rows of tables count as one field:
    const getItemWeight = (item, index, isOpen = isItemOpen(item, index)) => {
      let weight = 1
      if (source.isInlined.value && isOpen) {
        walkData(getItemFormSchema(props.schema, item, context), item, {
          dataPath: appendDataPath(props.dataPath, index),
          sourceSchema: props.schema,
          services,
          rootData: context.rootItem,
          shouldSkipIrrelevant: true,
          visit: () => weight++
        })
      }
      return weight
    }
    const { renderedItems, renderItemsUpTo } = useRenderedItems(
      listData,
      getItemWeight
    )
    // The tree renders the items that it reveals:
    provideToNode(source.node, 'renderItemsUpTo', renderItemsUpTo)
    const hasListButtons = computed(
      () => !!(source.buttonSchemas.value || creatable.value)
    )
    // Expand the items in steps, as opening them all at once blocks the page
    // for long, in the order in which `useRenderedItems()` renders them:
    let expandedCount = 0
    const expandSteps = useSteps(fields => {
      const count = countStepItems(
        listData.value,
        expandedCount,
        fields,
        (item, index) => getItemWeight(item, index, true)
      )
      const rows = table
        .getRowModel()
        .rows.slice(expandedCount, expandedCount + count)
      table.setExpanded(expanded => ({
        ...expanded,
        ...Object.fromEntries(rows.map(row => [row.id, true]))
      }))
      expandedCount += count
      if (expandedCount >= listData.value.length) {
        expandSteps.stop()
      }
    })
    // While expanding, the items count as expanded already:
    const hasCollapsedItems = computed(
      () => !expandSteps.isRunning.value && !table.getIsAllRowsExpanded()
    )
    const hasToggleAll = computed(
      () => (
        source.collapsible.value &&
        listData.value.length > 0 &&
        getSchemaValue('collapsible') === 'all'
      )
    )
    const toggleAllTitle = computed(() =>
      hasCollapsedItems.value ? 'Expand All' : 'Collapse All'
    )
    // Only the loaded items, which fire their toggle events themselves.
    // Collapsing is cheap, and stops any expanding:
    const toggleAll = () => {
      if (hasCollapsedItems.value) {
        expandedCount = 0
        expandSteps.start()
      } else {
        expandSteps.stop()
        table.toggleAllRowsExpanded(false)
      }
    }
    // The label of the container toggles all items, if there is one:
    const labelToggle = inject(labelToggleKey)
    watchEffect(() => {
      labelToggle.value = hasToggleAll.value
        ? {
            collapsed: hasCollapsedItems.value,
            title: toggleAllTitle.value,
            toggle: toggleAll
          }
        : null
    })

    return {
      ...source,
      table,
      itemColumnId,
      buttonsColumnId,
      expandColumnId,
      getColumnStyle,
      hasPreview,
      // Tables with sized columns grow wider than the list, and scroll:
      hasSizedColumns: computed(() =>
        Object.values(source.columns.value ?? {}).some(
          column => column.width || column.resizable
        )
      ),
      // The columns that viewers can hide, as items of the columns menu:
      columnItems: computed(() =>
        table
          .getAllLeafColumns()
          .filter(column => column.getCanHide())
          .map(column => ({
            value: column.id,
            label: getLabelText(column.columnDef.meta.schema),
            checked: column.getIsVisible()
          }))
      ),
      // The rendered rows with their items and their indices in the list:
      rows: computed(() =>
        table
          .getRowModel()
          .rows.slice(0, renderedItems.value.length)
          .map(row => ({ row, item: row.original, index: row.index }))
      ),
      labelize,
      getItemFormSchema,
      getDraggableOptions,
      moveItem,
      hasListButtons,
      hasEditButtons,
      dataModel: computed(() => source.services.dataContext.model),
      hasPagination: computed(() => !!source.paginate.value),
      hasEvenCount: computed(() => !(listData.value.length % 2)),
      hasCollapsedItems,
      hasToggleAll,
      toggleAllTitle,
      toggleAll,
      emptyText: computed(() => getSchemaValue('empty', { type: String })),

      numColumns: computed(() => table.getVisibleLeafColumns().length),

      page: computed({
        get() {
          return (+source.listQuery.query.page || 0) + 1
        },

        set(page) {
          source.listQuery.update({ page: page - 1 })
        }
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

      getPreviewHtml(item, index) {
        return getHtml(
          props.schema.preview(
            source.createContext({
              data: item,
              dataPath: appendDataPath(props.dataPath, index),
              nested: true
            })
          )
        )
      },

      getCellClass(column) {
        return `dito-cell--${hyphenate(column.id)}`
      },

      // Lists with their own resource save their items through it:
      clipboardName: computed(() => getClipboardName(props.schema)),

      hasClipboard: computed(
        () => !!props.schema.clipboard && !isSourceWithResource(props.schema)
      ),

      // Copy the loaded items like the forms copy theirs:
      async getClipboardData() {
        return {
          items: await Promise.all(
            listData.value.map((item, index) =>
              toClipboard(
                getItemFormSchema(props.schema, item, context),
                props.schema,
                item,
                appendDataPath(props.dataPath, index),
                { services, rootData: context.rootItem }
              )
            )
          )
        }
      },

      getClipboardUploadEntries({ items }) {
        return items.flatMap((item, index) =>
          getUploadEntries(
            getItemFormSchema(props.schema, item, context),
            item,
            {
              dataPath: appendDataPath(props.dataPath, index),
              services,
              rootData: context.rootItem
            }
          )
        )
      },

      // Replace the items with the pasted ones of the list's forms, and leave
      // out the others. Like all writes, it's an edit only if it changes them:
      async pasteItems({ items }) {
        const forms = getFormSchemas(props.schema, context)
        const getForm = item => getItemFormSchemaFromForms(forms, item)
        const results = await Promise.all(
          items.filter(getForm).map((item, index) =>
            fromClipboard(getForm(item), item, {
              dataPath: appendDataPath(props.dataPath, index),
              sourceSchema: props.schema,
              services,
              rootData: context.rootItem
            })
          )
        )
        listData.value = results.map(({ data }) => data)
        listData.value.forEach((item, index) => {
          initializeData(getForm(item), item, services, {
            dataPath: appendDataPath(props.dataPath, index),
            rootData: context.rootItem
          })
        })
        source.onChange()
        const unresolvedLabels = results.flatMap(
          result => result.unresolvedLabels
        )
        if (unresolvedLabels.length > 0) {
          services.adminContext.notify({
            type: 'warning',
            text: `Not found when pasting: ${unresolvedLabels.join(', ')}`
          })
        }
      }
    }
  }
}

defineType({
  type: 'list',
  component: DitoListType,
  ...sourceTraits,
  sourceType: 'list',
  hasLabelButtons: true,
  alignsBelowLabels: false,

  getPanelSchema(api, schema, dataPath, services) {
    const { filters } = schema
    if (filters) {
      return createFiltersPanel(
        api,
        filters,
        computed({
          get() {
            return services.sourceContext.listQuery.query
          },

          // Only reset the page that the panel clears when the query changes:
          set({ page, ...query }) {
            services.sourceContext.listQuery.update(query, {
              resetPage: true
            })
          }
        }),
        services
      )
    }
  },

  async setupSchema({ schema, api, name }) {
    if (schema.clipboard && schema.resource) {
      console.warn(
        `Unsupported 'clipboard' in lists with 'resource': '${name}'.`
      )
    }
    await Promise.all([
      resolveSchemaComponent(schema),
      resolveSchemaComponents(schema.columns),
      sourceTraits.setupSchema({ schema, api, name })
    ])
  }
})

export default DitoListType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-list {
  $self: &;

  position: relative;

  &__header {
    display: flex;
    // Wrap the pagination below scopes that don't fit next to it:
    flex-wrap: wrap;
    justify-content: space-between;
    row-gap: $content-padding-half;
    padding-bottom: $content-padding-half;
    @include user-select(none);

    &:empty {
      display: none;
    }

    #{$self}__scopes,
    #{$self}__pagination {
      display: flex;
      flex: 0 1 auto;
      min-width: 0;
    }

    // The toggle and buttons of lists without a label:
    > .dito-chevron {
      align-self: center;
      margin-left: $form-spacing + $border-width - $focus-ring-padding;
    }

    .dito-label-buttons,
    #{$self}__columns {
      margin-left: auto;

      + #{$self}__columns,
      + #{$self}__pagination {
        margin-left: $form-spacing;
      }
    }

    #{$self}__pagination {
      margin-left: auto;
    }
  }

  &.dito-component--single {
    // The table scrolls between the header and the buttons:
    display: flex;
    flex-direction: column;
    height: 100%;

    #{$self}__table {
      // Scroll tables that are wider or taller than the view in their own box.
      // Only here, since it would clip the popups of nested lists:
      overflow: auto;
      flex: 1 1 0;
      min-height: 0;
      // End with the view's padding above the buttons, when scrolled down:
      padding-bottom: var(--pane-padding);
    }

    // Scroll up to the view's edges, from where the content starts:
    #{$self}__table,
    #{$self}__scopes {
      margin-inline: calc(-1 * var(--pane-padding));
      padding-inline: var(--pane-padding);
    }

    > #{$self}__buttons {
      // Span the list, also for its border and shadow, right below the table:
      align-self: stretch;
      margin-top: 0;
    }

    #{$self}__table-head {
      position: sticky;
      top: 0;
      background: $content-color-background;
      z-index: 1;
    }
  }
}
</style>
