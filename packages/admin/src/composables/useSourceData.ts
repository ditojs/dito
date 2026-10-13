import { computed, watch, type WritableComputedRef } from 'vue'
import { isArray, isNumber, isObject } from '@ditojs/utils'
import { updateOrder } from '../utils/schema/data.js'
import { isListSource } from '../utils/schema/structure.js'
import { getItemAdapter } from '../utils/schema/types.ts'
import type { ListEntry } from '../utils/DataModel.ts'
import type { Services } from '../utils/services.ts'
import type { Data } from '../utils/types.ts'
import type { FieldProps } from './useField.ts'

// The items of a list or object source, with primitives wrapped for its forms,
// and the data that it loads through its resource.
export function useSourceData(
  props: FieldProps,
  {
    services,
    value,
    total,
    getPageOffset
  }: {
    services: Services
    value: WritableComputedRef<any>
    total: WritableComputedRef<number | undefined>
    getPageOffset: () => number | undefined
  }
) {
  const isList = () => isListSource(props.schema)
  const itemAdapter = computed(() => getItemAdapter(props.schema))
  const getModel = () => services.dataContext!.model

  const isListResults = (data: any) => (
    isList() &&
    isObject(data) &&
    isNumber(data.total) &&
    isArray(data.results)
  )

  // The items in the data, primitives in lists that wrap them:
  const items = computed<any[]>(() => {
    const data = value.value
    return !isList()
      ? data != null
        ? [data]
        : []
      : (isListResults(data) ? data.results : data) || []
  })

  // Wrap the primitives by index, in items that read and write them in the
  // list, which also holds their errors. Each index keeps its item, so that
  // edits don't replace the item and its components:
  const wrappedItems: Data[] = []
  const getWrappedItem = (index: number) =>
    (wrappedItems[index] ??= Object.defineProperty(
      {},
      itemAdapter.value!.name,
      {
        get: () => items.value[index],
        set: value => {
          items.value[index] = value
        },
        enumerable: true
      }
    ))

  const listData = computed<Data[]>({
    get: () =>
      itemAdapter.value
        ? Array.from({ length: items.value.length }, (_, index) =>
            getWrappedItem(index)
          )
        : items.value,

    set(data) {
      const adapter = itemAdapter.value
      value.value = adapter
        ? data.map(adapter.unwrap)
        : !isList()
          ? data?.length > 0
            ? data[0]
            : null
          : updateOrder(props.schema, data)
    }
  })

  const objectData = computed<Data | null>({
    get: () => listData.value[0] || null,
    set: data => (listData.value = data ? [data] : [])
  })

  // The list in the data, for the change API of the data model:
  const listEntry = computed<ListEntry>(() => ({
    schema: props.schema,
    list: items.value,
    dataPath: props.dataPath
  }))

  // Loading isn't an edit, and replaces the source's changes:
  const setLoadedValue = (value: any) => {
    const { data, schema, dataPath } = props
    getModel().setLoaded({ schema, data, name: schema.name, dataPath }, value)
  }

  // Number the loaded items from the offset of the page, so that buttons can
  // store their order even if it never changes:
  const setLoadedListItems = (items: Data[]) =>
    setLoadedValue(updateOrder(props.schema, items, getPageOffset()))

  const unwrapListData = (data: any) => {
    if (isListResults(data)) {
      total.value = data.total
      setLoadedListItems(data.results)
      return true
    }
    return false
  }

  // Unwrap `{ results, total }` also when inherited from the parent:
  watch(value, data => unwrapListData(data), { immediate: true })

  return {
    isListSource: computed(isList),
    isObjectSource: computed(() => !isList()),
    listData,
    objectData,
    listEntry,
    hasData: computed(() => !!value.value),

    // Insert the item, or the primitive that it wraps, and return it as listed:
    insertItem(index: number, item: Data) {
      const adapter = itemAdapter.value
      getModel().insert(
        listEntry.value,
        index,
        adapter ? adapter.unwrap(item) : item
      )
      return listData.value[index]
    },

    // Views load their whole data through the resource of their list:
    setData(data: any) {
      const { routeContext } = services
      if (isList() && isArray(data)) {
        setLoadedListItems(data)
      } else if (!data || !isList() && isObject(data)) {
        setLoadedValue(data)
      } else if (
        !unwrapListData(data) &&
        isObject(data) &&
        routeContext?.isForm === false
      ) {
        routeContext.dataContext.resetItem(data)
      }
    }
  }
}
