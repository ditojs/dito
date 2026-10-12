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
  ContainerContext,
  type ContainerOwner
} from '../utils/ContainerContext.ts'
import { RouteContext, type RouteOwner } from '../utils/RouteContext.ts'
import { useLeaveGuard } from './useLeaveGuard.ts'
import type { AdminContext } from '../utils/AdminContext.ts'
import type { Schema } from '../utils/types.ts'

// The view or form, without the state of its route:
type RouteContainerOwner = ContainerOwner &
  Omit<
    RouteOwner,
    'routeRecord' | 'routeParams' | 'path' | 'isLastRoute' | 'isLeavingRoute'
  > & {
    readonly sourceSchema: Schema
    readonly isMutating?: boolean
    readonly verbs: Record<string, string>
  }

export function useRouteContainer(owner: RouteContainerOwner) {
  const admin = inject<AdminContext>('admin')!
  const router = useRouter()
  const container = new ContainerContext(owner)
  const route = new RouteContext(
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
      parent: inject<RouteContext | null>('route', null),
      container,
      router
    }
  )
  const { level } = route
  provide('route', route)

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
    { immediate: true, flush: 'sync' }
  )

  // Components of new routes replace the ones of the previous routes at their
  // level, which are unmounted after:
  admin.ui.routes[level] = route
  onUnmounted(() => {
    if (admin.ui.routes[level] === route) {
      // Drop the deeper levels too, as their components unmount first:
      admin.ui.routes.length = level
    }
  })

  const { navigateWithin } = useLeaveGuard(route, {
    admin,
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
          params: route.node.getParams(routeParams.value)
        }).path
      : router.currentRoute.value.path
  })

  return {
    ownContainer: container,
    ownRoute: route,
    routeRecord,
    routeParams,
    isLeavingRoute,
    isLastRoute,
    path,
    store: reactive({}),
    navigateWithin,

    schemaPath: computed(() => {
      const { sourceSchema } = owner
      return getSchemaPath(sourceSchema, sourceSchema.name, admin.api)
    })
  }
}
