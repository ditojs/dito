import { computed, markRaw, watch } from 'vue'
import { isString } from '@ditojs/utils'
import { ListQuery } from '../utils/ListQuery.js'
import { getNamedSchemas } from '../utils/schema/lookup.js'
import { isListSource } from '../utils/schema/structure.js'
import type { AdminContext } from '../utils/AdminContext.ts'
import type { Schema } from '../utils/types.ts'

export interface ListQueryProps {
  readonly schema: Schema
  readonly store: Record<string, any>
}

// The query of a source, e.g. its scope, page, order and filters, held by the
// route and remembered in the store of the source, see `ListQuery`, with the
// defaults of its scopes and columns and its pagination.
export function useListQuery(
  props: ListQueryProps,
  {
    admin,
    paginate,
    providesData,
    reloadData
  }: {
    admin: AdminContext
    paginate: () => number | undefined
    providesData: () => boolean
    reloadData: () => void
  }
) {
  const { router } = admin
  const columns = computed(
    () => getNamedSchemas(props.schema.columns) as Record<string, Schema> | null
  )
  const scopes = computed(
    () => getNamedSchemas(props.schema.scopes) as Record<string, Schema> | null
  )

  const defaultScope = computed(() => {
    const values = Object.values(scopes.value ?? {})
    return values.find(scope => scope.defaultScope) ?? values[0] ?? null
  })

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
      getDefaultQuery: () => ({
        scope: defaultScope.value?.name,
        page: props.schema.page,
        order: defaultOrder.value
      })
    })
  )

  // Setting the query navigates to it asynchronously, see `ListQuery.update()`.
  // The stored query only changes once the route did, when the watcher below
  // loads the list:
  const query = computed({
    get: () => listQuery.query,
    set: query => listQuery.update(query)
  })

  const total = computed({
    get: () => props.store.total,
    set: total => (props.store.total = total)
  })

  // Only lists paginate:
  const paginationRange = computed(() => {
    const amount = isListSource(props.schema) ? paginate() : null
    if (amount) {
      const { page = 0 } = query.value
      const start = page * amount
      return [start, start + amount - 1]
    }
    return null
  })

  watch(
    () => router.currentRoute.value,
    (to, from) => {
      if (
        providesData() &&
        // Only the query changed:
        from.path === to.path &&
        from.hash === to.hash &&
        listQuery.setFromRoute(to.query)
      ) {
        reloadData()
      }
    },
    // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
    { flush: 'post' }
  )

  return {
    listQuery,
    query,
    total,
    columns,
    scopes,
    defaultScope,
    paginationRange,

    // The query to load the list with, passing the pagination as range, so
    // that the server counts the results:
    getQueryParams() {
      const range = paginationRange.value
      const { page, ...params } = query.value
      return { ...params, ...(range && { range: range.join(',') }) }
    }
  }
}
