import {
  computed,
  inject,
  onUnmounted,
  provide,
  reactive,
  shallowRef,
  watch
} from 'vue'
import { useRouter, type RouteRecordNormalized } from 'vue-router'
import { getSchemaPath } from '../utils/schema/structure.js'
import {
  DataContext,
  type DataOwner
} from '../utils/DataContext.ts'
import { RouteContext, type RouteOwner } from '../utils/RouteContext.ts'
import { useLeaveGuard } from './useLeaveGuard.ts'
import type { AdminContext } from '../utils/AdminContext.ts'
import type { Schema } from '../utils/types.ts'

// The view or form, without the state of its route:
type RouteContainerOwner = DataOwner &
  Omit<
    RouteOwner,
    'routeRecord' | 'routeParams' | 'path' | 'isLastRoute' | 'isLeavingRoute'
  > & {
    readonly sourceSchema: Schema
    readonly isMutating?: boolean
    readonly verbs: Record<string, string>
  }

export function useRouteContainer(owner: RouteContainerOwner) {
  const adminContext = inject<AdminContext>('adminContext')!
  const router = useRouter()
  const dataContext = new DataContext(owner)
  const routeContext = new RouteContext(
    Object.setPrototypeOf(
      {
        get routeRecord() {
          return routeRecord.value
        },

        get routeParams() {
          return routeParams.value
        },

        get path() {
          return path.value
        },

        get isLastRoute() {
          return isLastRoute.value
        },

        get isLeavingRoute() {
          return isLeavingRoute.value
        }
      },
      owner
    ),
    {
      parent: inject<RouteContext | null>('routeContext', null),
      dataContext,
      router
    }
  )
  const { level } = routeContext
  provide('routeContext', routeContext)

  const routeRecord = shallowRef<RouteRecordNormalized | null>(null)
  const routeParams = shallowRef<Record<string, any>>({})
  watch(
    router.currentRoute,
    ({ matched, params }) => {
      // Components belong to the record that they're rendered for. While
      // they're left, they keep it until they're unmounted, as their data model
      // still reads their schema and node. Records of the same path replace it,
      // e.g. when the routes are set up again:
      const record = matched[level]
      if (
        record &&
        (!routeRecord.value || record.path === routeRecord.value.path)
      ) {
        routeRecord.value = record
        routeParams.value = params
      }
    },
    // Update synchronously, so the record changes with the route:
    { immediate: true, flush: 'sync' }
  )

  // Components of new routes replace the ones of the previous routes at their
  // level, which are unmounted after:
  adminContext.ui.routes[level] = routeContext
  onUnmounted(() => {
    if (adminContext.ui.routes[level] === routeContext) {
      // Drop the deeper levels too, as their components unmount first:
      adminContext.ui.routes.length = level
    }
  })

  const { navigateWithin } = useLeaveGuard(routeContext, {
    adminContext,
    isMutating: () => !!owner.isMutating,
    getCancelVerb: () => owner.verbs.cancel
  })

  const getMatched = () => router.currentRoute.value.matched

  const isLeavingRoute = computed(
    () => getMatched()[level]?.path !== routeRecord.value?.path
  )

  const isLastRoute = computed(
    () => routeRecord.value === getMatched().at(-1)
  )

  const path = computed(() => {
    const { name } = routeRecord.value!
    // The routes are replaced when the views are resolved again, e.g. after
    // logging in, while the components of the previous ones still exist:
    return router.hasRoute(name!)
      ? router.resolve({
          name,
          params: routeContext.node.getParams(routeParams.value)
        }).path
      : router.currentRoute.value.path
  })

  return {
    ownDataContext: dataContext,
    ownRouteContext: routeContext,
    routeRecord,
    routeParams,
    isLeavingRoute,
    isLastRoute,
    path,
    // The state that outlives the components, e.g. the query of lists:
    store: reactive({}),
    navigateWithin,

    schemaPath: computed(() => {
      const { sourceSchema } = owner
      return getSchemaPath(sourceSchema, sourceSchema.name, adminContext.api)
    })
  }
}
