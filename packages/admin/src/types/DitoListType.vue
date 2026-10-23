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
    v-if="scopes || hasPagination || hasClipboard || hasToggleAll && !labelId"
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
        :schema="schema"
        :label="labelText"
        type="list"
        :hasData="listData.length > 0"
        :getData="getClipboardData"
        :getUploadEntries="getClipboardUploadEntries"
        :createContext="createContext"
        :disabled="!creatable || disabled || readonly || isLoading"
        @paste="pasteItems"
      )
    DitoPagination.dito-list__pagination(
      v-if="hasPagination"
      :listQuery="listQuery"
      :limit="paginate"
      :total="total || 0"
    )
  .dito-list__table
    table.dito-table(
      :class=`{
        'dito-table--separators': isInlined,
        'dito-table--larger-padding': hasEditButtons && !isInlined,
        'dito-table--alternate-colors': !isInlined,
        'dito-table--even-count': hasEvenCount
      }`
    )
      DitoTableHead.dito-list__table-head(
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
                template(
                  v-if="$slots.default"
                  #default="{ context }"
                )
                  slot(:context="context")
          td.dito-table__buttons(
            v-if="hasCellEditButtons"
          )
            DitoEditButtons(
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
import { getCreatableForms, getItemUid } from '../utils/schema/data.js'
import {
  getItemFormSchema,
  getItemFormSchemaFromForms
} from '../utils/schema/lookup.js'
import { isSourceWithResource } from '../utils/schema/structure.js'
import { fromClipboard } from '../utils/fromClipboard.ts'
import { toClipboard } from '../utils/toClipboard.ts'
import { getUploadEntries } from '../utils/interchange.ts'
import { labelToggleKey } from '../utils/keys.ts'
import { hyphenate, labelize } from '@ditojs/utils'
import { computed, inject, watchEffect } from 'vue'

// @vue/component
const DitoListType = {
  components: { DitoSourceItem, DitoClipboard, DitoLabelButtons },
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
    const { services, context, getItemStore } = source
    const { getSchemaValue, shouldRenderSchema } = useSchemaValue(context)
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
    // The inlined schemas of the items read their state from their stores:
    const hasCollapsedItems = computed(() =>
      listData.value.some(
        item => !(getItemStore(item).opened ?? !source.collapsed.value)
      )
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
    // Only the loaded items, which fire their toggle events themselves:
    const toggleAll = () => {
      const opened = hasCollapsedItems.value
      for (const item of listData.value) {
        getItemStore(item).opened = opened
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
      shouldRenderSchema,
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
      hasCollapsedItems,
      hasToggleAll,
      toggleAllTitle,
      toggleAll,
      emptyText: computed(() => getSchemaValue('empty', { type: String })),

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
      },

      // Lists with their own resource save their items through it:
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

      // Append the items with their creatable forms, and leave out the others:
      async pasteItems({ items }) {
        const forms = getCreatableForms(props.schema, context)
        const getForm = item => getItemFormSchemaFromForms(forms, item)
        const offset = listData.value.length
        const results = await Promise.all(
          items.filter(getForm).map((item, index) =>
            fromClipboard(getForm(item), item, {
              dataPath: appendDataPath(props.dataPath, offset + index),
              services,
              rootData: context.rootItem
            })
          )
        )
        for (const { data } of results) {
          source.insertItem(getForm(data), data)
        }
        if (results.length > 0) {
          source.onChange()
        }
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

    .dito-label-buttons {
      margin-left: auto;

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
