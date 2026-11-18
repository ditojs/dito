import { computed, ref, type Ref } from 'vue'
import {
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  functionalUpdate,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type CellData,
  type Column,
  type ColumnDef,
  type ExpandedState,
  type RowData,
  type TableFeatures,
  type SortingState,
  type Updater
} from '@tanstack/vue-table'
import { getItemUid } from '../utils/schema/data.js'
import { getStoredItem, setStoredItem } from '../utils/storage.ts'
import type { ListQuery } from '../utils/ListQuery.js'
import type { Schema } from '../utils/types.ts'

const features = tableFeatures({
  rowSortingFeature,
  rowExpandingFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature
})

type Item = Record<string, unknown>
type Store = Record<string, any>

declare module '@tanstack/vue-table' {
  // The columns of the schema, which the columns that Dito adds don't have:
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData
  > {
    schema: Schema
  }
}

// Lists without columns show each item in the `$item` column, the buttons get
// the `$buttons` column, and lists with previews get the `$expand` column
// with the buttons that open them. Column names don't start with `$`:
export const itemColumnId = '$item'
export const buttonsColumnId = '$buttons'
export const expandColumnId = '$expand'

// The columns that Dito adds can't be hidden or resized:
const displayColumn = { enableHiding: false, enableResizing: false }

// The table of a list. TanStack Table holds its columns, rows, sorting,
// expansion and column layout. The list's query holds the order, which the
// server applies. The item stores hold which items are open, and the browser's
// storage holds how viewers change the columns, under `storageKey`.
export function useListTable({
  schema,
  storageKey,
  items,
  columns,
  listQuery,
  hasButtons,
  hasPreview,
  expandable,
  isItemOpen,
  getItemStore,
  shouldRenderSchema
}: {
  schema: Schema
  storageKey: string
  items: Ref<Item[]>
  columns: Ref<Record<string, Schema> | null>
  listQuery: ListQuery
  hasButtons: Ref<boolean>
  hasPreview: Ref<boolean>
  expandable: Ref<boolean>
  isItemOpen: (item: Item, index: number) => boolean
  getItemStore: (item: Item, index: number) => Store
  shouldRenderSchema: (schema: Schema) => boolean
}) {
  // Leave out the columns hidden through `if`:
  const schemaColumns = computed(() =>
    Object.values(columns.value ?? {}).filter(shouldRenderSchema)
  )

  const columnDefs = computed((): ColumnDef<typeof features, Item>[] => [
    // The preview buttons are as wide as `.dito-table__expand`:
    ...(
      hasPreview.value
        ? [{ id: expandColumnId, size: 40, ...displayColumn }]
        : []
    ),
    ...(
      columns.value
        ? schemaColumns.value.map(column => ({
            id: column.name,
            accessorFn: (item: Item) => item[column.name],
            enableSorting: !!column.sortable,
            enableHiding: !!(column.hideable || column.hidden),
            enableResizing: !!column.resizable,
            ...(column.width && { size: column.width }),
            meta: { schema: column }
          }))
        : [{ id: itemColumnId, ...displayColumn }]
    ),
    ...(hasButtons.value ? [{ id: buttonsColumnId, ...displayColumn }] : [])
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

  // Pinned columns stick to the edges of the table, the preview buttons before
  // the ones at the start:
  const columnPinning = computed(() => {
    const getPinned = (position: string) =>
      schemaColumns.value
        .filter(column => column.pinned === position)
        .map(column => column.name)
    const start = getPinned('start')
    return {
      start: start.length > 0 ? [expandColumnId, ...start] : [],
      end: getPinned('end')
    }
  })

  // The columns that viewers hide, move and resize, remembered across reloads:
  const layout = ref(JSON.parse(getStoredItem(storageKey) ?? '{}'))
  const getStoredState = <T>(key: string, getDefault: () => T) => {
    const state = computed((): T => layout.value[key] ?? getDefault())
    const onChange = (updater: Updater<T>) => {
      layout.value = {
        ...layout.value,
        [key]: functionalUpdate(updater, state.value)
      }
      setStoredItem(storageKey, JSON.stringify(layout.value))
    }
    return [state, onChange] as const
  }
  // The columns with `hidden` start hidden, also when the table resets them:
  const initialState = {
    columnVisibility: Object.fromEntries(
      schemaColumns.value
        .filter(column => column.hidden)
        .map(column => [column.name, false])
    )
  }
  const [columnVisibility, onColumnVisibilityChange] = getStoredState(
    'columnVisibility',
    () => initialState.columnVisibility
  )
  const [columnOrder, onColumnOrderChange] = getStoredState(
    'columnOrder',
    (): string[] => []
  )
  const [columnSizing, onColumnSizingChange] = getStoredState(
    'columnSizing',
    (): Record<string, number> => ({})
  )

  const table = useTable<typeof features, Item>({
    features,
    columns: columnDefs,
    // The table compares the data by reference, and lists change in place:
    data: computed(() => [...items.value]),
    getRowId,
    initialState,
    state: computed(() => ({
      sorting: sorting.value,
      expanded: expanded.value,
      columnVisibility: columnVisibility.value,
      columnOrder: columnOrder.value,
      columnPinning: columnPinning.value,
      columnSizing: columnSizing.value
    })),
    manualSorting: true,
    // Clicks toggle the order of the sorted column, and sort others ascending:
    enableSortingRemoval: false,
    sortDescFirst: false,
    // The stores keep the expansion when the data changes:
    manualExpanding: true,
    getRowCanExpand: () => expandable.value,
    columnResizeMode: 'onChange',
    onColumnVisibilityChange,
    onColumnOrderChange,
    onColumnSizingChange,

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

// The width of resizable columns and of those with `width`, and the offsets of
// pinned ones, for their header and cells:
export function getColumnStyle(column: Column<typeof features, Item>) {
  const position = column.getIsPinned()
  return {
    ...((column.getCanResize() || column.columnDef.meta?.schema.width) && {
      width: `${column.getSize()}px`
    }),
    ...(position && {
      position: 'sticky',
      zIndex: 1,
      ...(
        position === 'start'
          ? { insetInlineStart: `${column.getStart('start')}px` }
          : { insetInlineEnd: `${column.getAfter('end')}px` }
      )
    })
  }
}
