import {
  computed,
  getCurrentInstance,
  inject,
  onUnmounted,
  provide,
  reactive,
  shallowRef,
  watch
} from 'vue'
import { useRouter, type RouteRecordNormalized } from 'vue-router'
import { getSchemaPath } from '../utils/schema/structure.js'
import { ContainerContext } from '../utils/ContainerContext.ts'
import { RouteContext } from '../utils/RouteContext.ts'
import { useLeaveGuard } from './useLeaveGuard.ts'
import type { AdminContext } from '../utils/AdminContext.ts'

// The container and route contexts of a view or form, which it provides to its
// components, and the state of its route.
export function useRouteContainer() {
  // NOTE: The schema and data of views and forms are still members of their
  // components, which the contexts read:
  const owner = getCurrentInstance()!.proxy as any
  const admin = inject<AdminContext>('admin')!
  const router = useRouter()
  const container = new ContainerContext(owner)
  const route = new RouteContext(owner, {
    parent: inject<RouteContext | null>('route', null),
    container,
    router
  })
  const { level } = route
  provide('container', container)
  provide('route', route)

  // The record of the route that the component renders, and its parameters
  // while the record is matched:
  const routeRecord = shallowRef<RouteRecordNormalized | null>(null)
  const routeParams = shallowRef<Record<string, any>>({})
  // Update synchronously, so that the record changes with the route:
  watch(
    router.currentRoute,
    ({ matched, params }) => {
      // Components belong to the record that they're rendered for, see
      // `DitoRouterView`. Records of other paths, or none, mean that the
      // component is being left, and it keeps its record until it's
      // unmounted, as its schema and node are still read in the meantime,
      // e.g. by the watchers of its data model. Records of the same path
      // replace it, e.g. when the routes are set up again.
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
      // Also drop the deeper levels, which aren't replaced by those of a new
      // route either, as their components are unmounted before their parents.
      admin.ui.routes.length = level
    }
  })

  const { navigateWithin } = useLeaveGuard(route, {
    admin,
    isMutating: () => !!owner.isMutating,
    getCancelVerb: () => owner.verbs.cancel
  })

  const getMatched = () => router.currentRoute.value.matched

  return {
    ownContainer: container,
    ownRoute: route,
    routeRecord,
    routeParams,
    // Each view and form has a store that it passes on to its components, for
    // the state that outlives them, e.g. the query of lists, see `getStore()`:
    store: reactive({}),
    navigateWithin,

    isLeavingRoute: computed(
      () => getMatched()[level]?.path !== routeRecord.value?.path
    ),

    isLastRoute: computed(() => routeRecord.value === getMatched().at(-1)),

    path: computed(() => {
      const { name } = routeRecord.value!
      // The routes are replaced when the views are resolved again, e.g. after
      // logging in, while the components of the previous ones still exist:
      return router.hasRoute(name!)
        ? router.resolve({
            name,
            params: route.node.getParams(routeParams.value)
          }).path
        : router.currentRoute.value.path
    }),

    // The path of the view or source, e.g. for selectors of its styles:
    schemaPath: computed(() => {
      const { sourceSchema } = owner
      return getSchemaPath(sourceSchema, sourceSchema.name, admin.api)
    })
  }
}
