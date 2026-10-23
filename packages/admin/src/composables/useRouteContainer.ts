import {
  computed,
  inject,
  markRaw,
  nextTick,
  onUnmounted,
  reactive,
  shallowReactive,
  shallowRef,
  watch
} from 'vue'
import { useRouter, type RouteRecordNormalized } from 'vue-router'
import { isPathWithin, navigate } from '../utils/route.js'
import { getSchemaPath, isPage } from '../utils/schema/structure.js'
import { adminContextKey, routeContextKey } from '../utils/keys.ts'
import { LoadingTracker } from '../utils/LoadingTracker.ts'
import { MenuNode } from '../utils/RouteTree.ts'
import { useContainer, type ContainerOptions } from './useContainer.ts'
import { useLeaveGuard } from './useLeaveGuard.ts'
import type { RouteClaim, RouteContext } from '../utils/RouteContext.ts'
import type { ResourceContext } from '../utils/ResourceContext.ts'

export interface RouteContainerOptions
  extends Omit<ContainerOptions, 'routeContext'> {
  route: RouteRecord
  sourceSchema: NonNullable<ContainerOptions['sourceSchema']>
  isTransient?: () => boolean
  isMutating?: () => boolean
  breadcrumb: () => string
  verbs: () => Record<string, string>
  // The text of the label of the item that forms edit:
  itemLabel?: () => string | null
  // Forms with a resource of their own:
  resourceContext?: ResourceContext | null
}

export type RouteRecord = ReturnType<typeof useRouteRecord>

// The route that the view or form at the next level is rendered for: the
// record of views, or the claim of the route above for forms.
export function useRouteRecord() {
  const router = useRouter()
  const parent = inject(routeContextKey, null)
  const level = parent ? parent.level + 1 : 0
  const record = shallowRef<RouteRecordNormalized | null>(null)
  const params = shallowRef<Record<string, any>>({})
  const claim = shallowRef<RouteClaim | null>(null)
  watch(
    router.currentRoute,
    ({ matched, params: routeParams }) => {
      // Components belong to the record that they're rendered for. While
      // they're left, they keep it until they're unmounted, as their data model
      // still reads their schema and node. Records of the same path replace it,
      // e.g. when the routes are set up again:
      const matchedRecord = matched[level]
      if (
        matchedRecord?.meta.node &&
        (!record.value || matchedRecord.path === record.value.path)
      ) {
        record.value = matchedRecord
        params.value = routeParams
      }
    },
    // Update synchronously, so the record changes with the route:
    { immediate: true, flush: 'sync' }
  )
  // Forms keep their claim while they're left in the same way:
  watch(
    () => (record.value ? null : parent!.childClaim),
    newClaim => {
      if (newClaim && (!claim.value || newClaim.key === claim.value.key)) {
        claim.value = newClaim
      }
    },
    { immediate: true, flush: 'sync' }
  )
  return {
    parent,
    level,
    record,
    params,
    claim,
    node: computed(() => record.value?.meta.node ?? null)
  }
}

// Set up a view or form as the container of its data and of its route.
export function useRouteContainer({
  route,
  isTransient = () => false,
  isMutating = () => false,
  breadcrumb,
  verbs,
  itemLabel = () => null,
  resourceContext = null,
  ...options
}: RouteContainerOptions) {
  const adminContext = inject(adminContextKey)!
  const router = useRouter()
  const { parent, level, record: routeRecord, params: routeParams } = route
  const getCurrentPath = () => router.currentRoute.value.path

  const path = computed(() => {
    if (route.claim.value) {
      return route.claim.value.path
    }
    const { name } = routeRecord.value!
    // The routes are replaced when the views are resolved again, e.g. after
    // logging in, while the components of the previous ones still exist:
    return router.hasRoute(name!)
      ? router.resolve({
          name,
          params: route.node.value!.getParams(routeParams.value)
        }).path
      : getCurrentPath()
  })

  // The components of the route claim the paths below it, and the forms of
  // single-component views that share the path of their view. The schema of
  // the route claims the names of its tabs, which open no form:
  const pathClaim = computed(() =>
    routeContext.isLeaving
      ? null
      : adminContext.ui.claimRoute(routeContext.dataContext, getCurrentPath())
  )
  const childClaim = computed(() =>
    pathClaim.value && !('tab' in pathClaim.value) ? pathClaim.value : null
  )

  const routeContext: RouteContext = shallowReactive({
    parent,
    level,
    selectedTab: null,
    isWide: false,
    componentForm: null,
    resourceContext: resourceContext ?? parent?.resourceContext ?? null,

    // Pages have no data of their own, their routes edit the data of the form
    // of their component. Other routes only take its changes and item:
    get dataContext() {
      const { componentForm } = routeContext
      return componentForm && isPage(options.sourceSchema())
        ? componentForm.dataContext
        : container.dataContext
    },

    get node() {
      return route.node.value
    },

    get claim() {
      return route.claim.value
    },

    get childClaim() {
      return childClaim.value
    },

    get routeTab() {
      return pathClaim.value && 'tab' in pathClaim.value
        ? pathClaim.value.tab
        : null
    },

    get isForm() {
      return !!route.claim.value
    },

    get isTransient() {
      return isTransient() || routeContext.dataContext.isCreating
    },

    get path() {
      return path.value
    },

    get isLastRoute() {
      return (
        !!routeContext.routeTab ||
        !childClaim.value && getCurrentPath() === path.value
      )
    },

    get isActive() {
      return childClaim.value
        ? childClaim.value.isEmbedded
        : routeContext.isLastRoute
    },

    get isLeaving() {
      return !isPathWithin(getCurrentPath(), path.value)
    },

    get isDirty() {
      return (
        container.dataContext.isDirty ||
        !!routeContext.componentForm?.dataContext.isDirty
      )
    },

    get breadcrumb() {
      return breadcrumb()
    },

    get verbs() {
      return verbs()
    },

    get itemLabel() {
      return itemLabel() ?? routeContext.componentForm?.itemLabel ?? null
    },

    loadingTracker: (
      parent?.loadingTracker ??
      markRaw(new LoadingTracker(adminContext.loadingTracker))
    ),

    getFormRoute(componentPath: string) {
      return adminContext.ui.getFormRoute(
        routeContext.dataContext,
        componentPath
      )
    },

    getFormPath(componentPath: string) {
      const route = routeContext.getFormRoute(componentPath)
      return route && !route.componentPath ? route.path : null
    },

    close() {
      if (!parent) {
        throw new Error('Unable to close the route: Views cannot be closed.')
      }
      // Object forms of single-component views share the path of their view,
      // so we leave the view for the admin's root:
      return navigate(router, path.value === parent.path ? '/' : parent.path)
    }
  })
  const container = useContainer({ ...options, routeContext })

  // Components of new routes replace the ones of the previous routes at their
  // level, which are unmounted after:
  adminContext.ui.routes[level] = routeContext
  onUnmounted(() => {
    if (adminContext.ui.routes[level] === routeContext) {
      // Drop the deeper levels too, as their components unmount first:
      adminContext.ui.routes.length = level
    }
  })

  // Paths that no component claims lead back to the route, once it renders its
  // components with its data. Menus render their views below them instead:
  const isUnclaimed = () => (
    !childClaim.value &&
    !routeContext.isLastRoute &&
    !routeContext.isLeaving &&
    !(route.node.value instanceof MenuNode) &&
    routeContext.dataContext.hasData
  )
  watch(
    isUnclaimed,
    async isUnclaimedPath => {
      if (isUnclaimedPath) {
        await nextTick()
        if (isUnclaimed()) {
          router.replace(path.value)
        }
      }
    },
    { immediate: true, flush: 'post' }
  )

  const { navigateWithin, replaceWithin } = useLeaveGuard(routeContext, {
    adminContext,
    isMutating
  })

  return {
    ...container,
    routeContext,
    navigateWithin,
    replaceWithin,
    // The state that outlives the components, e.g. the query of lists:
    store: reactive({}),

    schemaPath: computed(() => {
      const sourceSchema = options.sourceSchema()!
      return getSchemaPath(sourceSchema, sourceSchema.name, adminContext.api)
    })
  }
}
