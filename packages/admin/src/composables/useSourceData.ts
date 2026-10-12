import { computed, ref, watch, type WritableComputedRef } from 'vue'
import { equals, isArray, isNumber, isObject } from '@ditojs/utils'
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
  const wrappedPrimitives = ref<Data[] | null>(null)
  const getModel = () => services.container!.model

  const isListResults = (data: any) => (
    isList() &&
    isObject(data) &&
    isNumber(data.total) &&
    isArray(data.results)
  )

  const valueListData = computed<any[]>(() => {
    const data = value.value
    return !isList()
      ? data != null
        ? [data]
        : []
      : (isListResults(data) ? data.results : data) || []
  })

  // Copy the values to track their changes too:
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

  const listEntry = computed<ListEntry>(() => ({
    schema: props.schema,
    list: listData.value,
    dataPath: props.dataPath
  }))

  // Loading isn't an edit, and replaces the source's changes:
  const setLoadedValue = (data: any) => {
    props.data[props.schema.name] = data
    getModel().markClean({ dataPath: props.dataPath })
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

  // Wrap the primitives for the forms, unless they were just unwrapped:
  watch(
    primitiveValues,
    values => {
      if (values && !equals(values, unwrapPrimitives())) {
        wrappedPrimitives.value = values.map(itemAdapter.value!.wrap)
      }
    },
    { immediate: true }
  )

  // Write edits back in place, as the list holds the errors of its values:
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
    listData,
    objectData,
    listEntry,
    hasData: computed(() => !!value.value),

    clearData() {
      total.value = 0
      setLoadedValue(null)
    },

    // Views load their whole data through the resource of their list:
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
