import { computed, markRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { isString } from '@ditojs/utils'
import { ListQuery } from '../utils/ListQuery.js'
import { getTabKeys, getTabQuery } from '../utils/filter.js'
import { getNamedSchemas } from '../utils/schema/lookup.js'
import { isListSource } from '../utils/schema/structure.js'
import type { Schema } from '../utils/types.ts'
import type { FieldProps } from './useField.ts'

// The page, order and filters of a list, remembered in the store, and
// held by the route for lists that load their data in routes, see `ListQuery`.
export function useListQuery(
  props: FieldProps,
  {
    getPaginate,
    isInRoute,
    isRouted,
    onChange
  }: {
    getPaginate: () => number | undefined
    // Lists in routes change the query through the route...
    isInRoute: () => boolean
    // ...and those that load their data also follow it while they're shown:
    isRouted: () => boolean
    // Called once the query changed, which the list loads:
    onChange: () => void
  }
) {
  const router = useRouter()
  const columns = computed(
    () => getNamedSchemas(props.schema.columns) as Record<string, Schema> | null
  )
  const filterTabs = computed(
    () =>
      getNamedSchemas(props.schema.filterTabs) as Record<string, Schema> | null
  )

  const defaultTab = computed(() => {
    const values = Object.values(filterTabs.value ?? {})
    return values.find(tab => tab.default) ?? values[0] ?? null
  })

  const tabKeys = computed(() => getTabKeys(filterTabs.value))

  const defaultOrder = computed(() => {
    for (const column of Object.values(columns.value ?? {})) {
      const { defaultSort } = column
      if (defaultSort) {
        const direction = isString(defaultSort) ? defaultSort : 'asc'
        return `${column.name} ${direction}`
      }
    }
    return null
  })

  const listQuery = markRaw(
    new ListQuery({
      router,
      getRoute: () => router.currentRoute.value,
      getSourceStore: () => props.store,
      getTabKeys: () => tabKeys.value,
      // The default tab only applies while no tab is selected:
      getDefaultQuery: (query: Record<string, unknown>) => ({
        ...(!tabKeys.value.some(key => key in query) &&
        getTabQuery(defaultTab.value)),
        page: props.schema.page,
        order: defaultOrder.value
      }),
      isInRoute,
      onChange
    })
  )

  const paginationRange = computed(() => {
    const amount = isListSource(props.schema) ? getPaginate() : null
    if (amount) {
      const { page = 0 } = listQuery.query
      const start = page * amount
      return [start, start + amount - 1]
    }
    return null
  })

  // Setting the query navigates to it, and the stored query only changes once
  // the route did, when the list loads. Lists take the route again when they're
  // shown, e.g. once the forms of their items close:
  watch(
    isRouted,
    isRouted => {
      if (isRouted) {
        listQuery.syncWithRoute()
      }
    },
    { immediate: true }
  )
  watch(
    () => router.currentRoute.value,
    (to, from) => {
      if (
        isRouted() &&
        from.path === to.path &&
        listQuery.setFromRoute(to.query)
      ) {
        onChange()
      }
    },
    // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
    { flush: 'post' }
  )

  return {
    listQuery,
    columns,
    filterTabs,
    paginationRange,

    // Pass the pagination as range, so that the server counts the results:
    getRequestQuery() {
      const range = paginationRange.value
      const { page, ...query } = listQuery.query
      return { ...query, ...(range && { range: range.join(',') }) }
    }
  }
}
