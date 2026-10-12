import { computed, ref, watch, type WritableComputedRef } from 'vue'
import { equals, isArray, isNumber, isObject } from '@ditojs/utils'
import { updateOrder } from '../utils/schema/data.js'
import { isListSource } from '../utils/schema/structure.js'
import { getItemAdapter } from '../utils/schema/types.ts'
import type { ListEntry } from '../utils/DataModel.ts'
import type { Services } from '../utils/services.ts'
import type { Data, Schema } from '../utils/types.ts'

export interface SourceDataProps {
  readonly schema: Schema
  readonly data: Data
  readonly dataPath: string
}

// The items of a list or object source in its value, wrapped for its forms if
// they're primitives, and the data that the source loads through its resource.
export function useSourceData(
  props: SourceDataProps,
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
  // Sources hold either a list or an object:
  const isList = () => isListSource(props.schema)
  const itemAdapter = computed(() => getItemAdapter(props.schema))
  const wrappedPrimitives = ref<Data[] | null>(null)
  const getModel = () => services.container!.model

  // Lists can also be loaded as `{ results, total }`, see `setData()`:
  const isListResults = (data: any) => (
    isList() &&
    isObject(data) &&
    isNumber(data.total) &&
    isArray(data.results)
  )

  // The items held by the value, before wrapping primitives:
  const valueListData = computed<any[]>(() => {
    const data = value.value
    return !isList()
      ? data != null
        ? [data]
        : []
      : (isListResults(data) ? data.results : data) || []
  })

  // Copied, so that changes of the values are tracked too:
  const primitiveValues = computed(() =>
    itemAdapter.value ? [...valueListData.value] : null
  )

  const unwrapPrimitives = () => {
    const adapter = itemAdapter.value
    return adapter && wrappedPrimitives.value
      ? wrappedPrimitives.value.map(adapter.unwrap)
      : null
  }

  const listData = computed<Data[]>({
    get: () =>
      itemAdapter.value ? wrappedPrimitives.value || [] : valueListData.value,

    set(data) {
      if (itemAdapter.value) {
        wrappedPrimitives.value = data
      } else {
        value.value = !isList()
          ? data?.length > 0
            ? data[0]
            : null
          : updateOrder(props.schema, data)
      }
    }
  })

  const objectData = computed<Data | null>({
    get: () => listData.value[0] || null,
    set: data => (listData.value = data ? [data] : [])
  })

  // The list for the change API of the data model:
  const listEntry = computed<ListEntry>(() => ({
    schema: props.schema,
    list: listData.value,
    dataPath: props.dataPath
  }))

  // Write the value loaded through the source's resource directly, as loading
  // isn't an edit, and replace the source's changes:
  const setLoadedValue = (data: any) => {
    props.data[props.schema.name] = data
    getModel().markClean({ dataPath: props.dataPath })
  }

  // Number the loaded items by their order key from the offset of the page,
  // so that their order can be stored even if it never changes, e.g. by a
  // button that saves the current order:
  const setLoadedListItems = (items: Data[]) =>
    setLoadedValue(updateOrder(props.schema, items, getPageOffset()))

  // Replace the value with the results of `{ results, total }`, and remember
  // the total in the store:
  const unwrapListData = (data: any) => {
    if (isListResults(data)) {
      total.value = data.total
      setLoadedListItems(data.results)
      return true
    }
    return false
  }

  // Values that were inherited from the parent are unwrapped here:
  watch(value, data => unwrapListData(data), { immediate: true })

  // Wrap the primitive values in objects for the list's forms to edit, unless
  // they're the values that were just unwrapped from them:
  watch(
    primitiveValues,
    values => {
      if (values && !equals(values, unwrapPrimitives())) {
        wrappedPrimitives.value = values.map(itemAdapter.value!.wrap)
      }
    },
    { immediate: true }
  )

  // Map edits of the wrapped primitives back to the primitive values, in
  // place, as the list holds the errors of its values:
  watch(
    wrappedPrimitives,
    () => {
      const values = unwrapPrimitives()
      const list = value.value
      if (values && !equals(values, primitiveValues.value)) {
        if (!isArray(list)) {
          value.value = values
        } else if (values.length === list.length) {
          values.forEach((value, index) => getModel().set(list, index, value))
        } else {
          const { schema, dataPath } = props
          getModel().replaceItems({ schema, list, dataPath }, values)
        }
      }
    },
    { deep: true }
  )

  return {
    isListSource: computed(isList),
    isObjectSource: computed(() => !isList()),
    itemAdapter,
    listData,
    objectData,
    listEntry,
    hasData: computed(() => !!value.value),

    clearData() {
      total.value = 0
      setLoadedValue(null)
    },

    // Set the data loaded through the resource, as an array, an object, or
    // `{ results, total }`. Views also load their whole data through the
    // resource of their list, including the list:
    setData(data: any) {
      const { route } = services
      if (isList() && isArray(data)) {
        setLoadedListItems(data)
      } else if (!data || !isList() && isObject(data)) {
        setLoadedValue(data)
      } else if (
        !unwrapListData(data) &&
        isObject(data) &&
        route?.isForm === false
      ) {
        route.container.replaceItem(data)
      }
    }
  }
}

export type SourceData = ReturnType<typeof useSourceData>
