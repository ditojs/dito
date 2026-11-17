import { computed, type Ref } from 'vue'
import {
  functionalUpdate,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  type Updater
} from '@tanstack/vue-table'
import { getItemUid } from '../utils/schema/data.js'
import type { ListQuery } from '../utils/ListQuery.js'
import type { Schema } from '../utils/types.ts'

const features = tableFeatures({ rowSortingFeature, rowExpandingFeature })

type Item = Record<string, unknown>

// Lists without columns show each item in the `$item` column, and the buttons
// get the `$buttons` column. Column names don't start with `$`:
export const itemColumnId = '$item'
export const buttonsColumnId = '$buttons'

// The table of a list. TanStack Table holds its columns, rows, sorting and
// expansion. The list's query holds the order, which the server applies, and
// the item stores hold which items are open.
export function useListTable({
  schema,
  items,
  columns,
  listQuery,
  hasButtons,
  collapsible,
  isItemOpen,
  getItemStore,
  shouldRenderSchema
}: {
  schema: Schema
  items: Ref<Item[]>
  columns: Ref<Record<string, Schema> | null>
  listQuery: ListQuery
  hasButtons: Ref<boolean>
  collapsible: Ref<boolean>
  isItemOpen: (item: Item, index: number) => boolean
  getItemStore: (item: Item, index: number) => Record<string, any>
  shouldRenderSchema: (schema: Schema) => boolean
}) {
  // Leave out the columns hidden through `if`, and the buttons column when
  // there are no buttons:
  const columnDefs = computed((): ColumnDef<typeof features, Item>[] => [
    ...(
      columns.value
        ? Object.values(columns.value)
            .filter(shouldRenderSchema)
            .map(column => ({
              id: column.name,
              accessorFn: (item: Item) => item[column.name],
              enableSorting: !!column.sortable,
              meta: { schema: column }
            }))
        : [{ id: itemColumnId }]
    ),
    ...(hasButtons.value ? [{ id: buttonsColumnId }] : [])
  ])

  const sorting = computed((): SortingState => {
    const [id, order] = (listQuery.query.order || '').split(/\s+/)
    return id ? [{ id, desc: order === 'desc' }] : []
  })

  const getRowId = (item: Item) => getItemUid(schema, item)

  const expanded = computed(
    (): Record<string, boolean> =>
      Object.fromEntries(
        items.value.map((item, index) => [
          getRowId(item),
          isItemOpen(item, index)
        ])
      )
  )

  const table = useTable<typeof features, Item>({
    features,
    columns: columnDefs,
    // The table compares the data by reference, and lists change in place:
    data: computed(() => [...items.value]),
    getRowId,
    state: computed(() => ({
      sorting: sorting.value,
      expanded: expanded.value
    })),
    manualSorting: true,
    // Clicks toggle the order of the sorted column, and sort others ascending:
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
    // The stores keep the expansion when the data changes:
    manualExpanding: true,
    getRowCanExpand: () => collapsible.value,

    // A sorted list has other pages, so sorting starts on the first one:
    onSortingChange(updater: Updater<SortingState>) {
      const [{ id, desc }] = functionalUpdate(updater, sorting.value)
      listQuery.update(
        { order: `${id} ${desc ? 'desc' : 'asc'}` },
        { resetPage: true }
      )
    },

    onExpandedChange(updater: Updater<ExpandedState>) {
      const current = expanded.value
      const state = functionalUpdate(updater, current)
      for (const { id, original, index } of table.getRowModel().rows) {
        const opened = state === true || !!state[id]
        if (opened !== current[id]) {
          getItemStore(original, index).opened = opened
        }
      }
    }
  })
  return table
}
