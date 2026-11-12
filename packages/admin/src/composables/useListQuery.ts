import { computed, markRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { asArray, isString } from '@ditojs/utils'
import { ListQuery } from '../utils/ListQuery.js'
import { getNamedSchemas } from '../utils/schema/lookup.js'
import { isListSource } from '../utils/schema/structure.js'
import type { Schema } from '../utils/types.ts'
import type { FieldProps } from './useField.ts'
import type { SchemaValueOptions } from './useSchemaValue.ts'

// The scope, page, order and filters of a list, remembered in the store, and
// held by the route for lists that load their data in routes, see `ListQuery`.
export function useListQuery(
  props: FieldProps,
  {
    getSchemaValue,
    getPaginate,
    isInRoute,
    isRouted,
    onChange
  }: {
    // Resolves callbacks of scopes with the context of the list:
    getSchemaValue: (key: string, options: SchemaValueOptions) => any
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
  const scopes = computed(
    () => getNamedSchemas(props.schema.scopes) as Record<string, Schema> | null
  )

  const defaultScope = computed(() => {
    const values = Object.values(scopes.value ?? {})
    return values.find(scope => scope.defaultScope) ?? values[0] ?? null
  })

  const getScope = (name?: string) =>
    name ? scopes.value?.[name] : defaultScope.value

  // The query that the server reads. Scopes with `filter` send their filters
  // instead of `scope`, after those of the panel, so that theirs apply.
  // `filter` can be a callback that returns the filters:
  function getServerQuery() {
    const { query } = listQuery
    const scope = getScope(query.scope)
    if (scope && 'filter' in scope) {
      const { scope: _, filter, ...rest } = query
      const scopeFilter = getSchemaValue('filter', {
        type: Object,
        schema: scope
      })
      const filters = [
        ...asArray(filter),
        ...Object.entries(scopeFilter ?? {}).map(
          ([name, value]) => `${name}:${JSON.stringify(value)}`
        )
      ]
      return { ...rest, ...(filters.length > 0 && { filter: filters }) }
    }
    return query
  }

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
      // The order of the selected scope applies until a column sets one:
      getDefaultQuery: (query: Record<string, string>) => ({
        scope: defaultScope.value?.name,
        page: props.schema.page,
        order: getScope(query.scope)?.order ?? defaultOrder.value
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
    scopes,
    paginationRange,

    getServerQuery,

    // Pass the pagination as range, so that the server counts the results:
    getRequestQuery() {
      const range = paginationRange.value
      const { page, ...query } = getServerQuery()
      return { ...query, ...(range && { range: range.join(',') }) }
    }
  }
}
