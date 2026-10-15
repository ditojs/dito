import {
  computed,
  inject,
  markRaw,
  onUnmounted,
  reactive,
  shallowReactive,
  shallowRef,
  watch
} from 'vue'
import { useRouter, type RouteRecordNormalized } from 'vue-router'
import { getRelativeDataPath } from '../utils/data.js'
import { navigate } from '../utils/route.js'
import { getSchemaPath } from '../utils/schema/structure.js'
import { adminContextKey, routeContextKey } from '../utils/keys.ts'
import { LoadingTracker } from '../utils/LoadingTracker.ts'
import {
  FormNode,
  type FormRoute,
  type Route,
  type ViewNode
} from '../utils/RouteTree.ts'
import { useContainer, type ContainerOptions } from './useContainer.ts'
import { useLeaveGuard } from './useLeaveGuard.ts'
import type { RouteContext } from '../utils/RouteContext.ts'
import type {
  ResourceContext,
  SubmitButton,
  SubmitOptions
} from '../utils/ResourceContext.ts'

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
  submit?: (button: SubmitButton, options?: SubmitOptions) => Promise<boolean>
}

export type RouteRecord = ReturnType<typeof useRouteRecord>

// The route record that the view or form at the next level is rendered for,
// with its node and parameters.
export function useRouteRecord() {
  const router = useRouter()
  const parent = inject(routeContextKey, null)
  const level = parent ? parent.level + 1 : 0
  const record = shallowRef<RouteRecordNormalized | null>(null)
  const params = shallowRef<Record<string, any>>({})
  watch(
    router.currentRoute,
    ({ matched, params: routeParams }) => {
      // Components belong to the record that they're rendered for. While
      // they're left, they keep it until they're unmounted, as their data model
      // still reads their schema and node. Records of the same path replace it,
      // e.g. when the routes are set up again:
      const matchedRecord = matched[level]
      if (
        matchedRecord &&
        (!record.value || matchedRecord.path === record.value.path)
      ) {
        record.value = matchedRecord
        params.value = routeParams
      }
    },
    // Update synchronously, so the record changes with the route:
    { immediate: true, flush: 'sync' }
  )
  return {
    parent,
    level,
    record,
    params,
    node: computed(() => record.value!.meta.node!)
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
  submit,
  ...options
}: RouteContainerOptions) {
  const adminContext = inject(adminContextKey)!
  const router = useRouter()
  const { parent, level, record: routeRecord, params: routeParams } = route
  const getMatched = () => router.currentRoute.value.matched
  const getNode = () => route.node.value

  const path = computed(() => {
    const { name } = routeRecord.value!
    // The routes are replaced when the views are resolved again, e.g. after
    // logging in, while the components of the previous ones still exist:
    return router.hasRoute(name!)
      ? router.resolve({
          name,
          params: getNode().getParams(routeParams.value)
        }).path
      : router.currentRoute.value.path
  })

  // Resolve the routes of the data path in the data of the route, which only
  // views and forms render, menus don't:
  const resolveRoute = (
    dataPath: string,
    getRoute: (
      node: ViewNode | FormNode,
      path: string
    ) => (Route & Partial<FormRoute>) | null
  ) => {
    const path = getRelativeDataPath(
      dataPath,
      routeContext.dataContext.dataPath
    )
    const route = (
      path !== null &&
      getRoute(getNode() as ViewNode | FormNode, path)
    )
    return route
      ? { path: router.resolve(route).path, dataPath: route.dataPath ?? '' }
      : null
  }

  const routeContext: RouteContext = shallowReactive({
    parent,
    level,
    selectedTab: null,
    resourceContext: resourceContext ?? parent?.resourceContext ?? null,

    get dataContext() {
      return container.dataContext
    },

    get node() {
      return getNode()
    },

    get childNode() {
      return getMatched()[level + 1]?.meta.node ?? null
    },

    get isForm() {
      return getNode() instanceof FormNode
    },

    get state() {
      return {
        data: container.dataContext.data,
        routeParams: routeParams.value,
        isTransient: isTransient() || container.dataContext.isCreating
      }
    },

    get path() {
      return path.value
    },

    get isLastRoute() {
      return routeRecord.value === getMatched().at(-1)
    },

    get isLeaving() {
      return getMatched()[level]?.path !== routeRecord.value?.path
    },

    get isDirty() {
      return container.dataContext.isDirty
    },

    get breadcrumb() {
      return breadcrumb()
    },

    get verbs() {
      return verbs()
    },

    get itemLabel() {
      return itemLabel()
    },

    loadingTracker: (
      parent?.loadingTracker ??
      markRaw(new LoadingTracker(adminContext.loadingTracker))
    ),

    getFormRoute(dataPath: string) {
      return resolveRoute(dataPath, (node, path) =>
        node.getFormRoute(path, routeContext.state)
      )
    },

    getFormPath(dataPath: string) {
      const route = routeContext.getFormRoute(dataPath)
      return route && !route.dataPath ? route.path : null
    },

    getCreatePath(dataPath: string) {
      return (
        resolveRoute(dataPath, (node, path) =>
          node.getCreateRoute(path, routeContext.state)
        )?.path ?? null
      )
    },

    close() {
      if (!parent) {
        throw new Error('Unable to close the route: Views cannot be closed.')
      }
      // Object forms of single-component views share the path of their view,
      // so we leave the view for the admin's root:
      const { source } = getNode() as FormNode
      return navigate(
        router,
        source.isViewComponent && !source.isList ? '/' : parent.path
      )
    },

    submit(button: SubmitButton, options?: SubmitOptions) {
      if (!submit) {
        throw new Error(
          'Unable to submit the route: Views cannot be submitted.'
        )
      }
      return submit(button, options)
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

  const { navigateWithin } = useLeaveGuard(routeContext, {
    adminContext,
    isMutating,
    getCancelVerb: () => routeContext.verbs.cancel
  })

  return {
    ...container,
    routeContext,
    navigateWithin,
    // The state that outlives the components, e.g. the query of lists:
    store: reactive({}),

    schemaPath: computed(() => {
      const sourceSchema = options.sourceSchema()!
      return getSchemaPath(sourceSchema, sourceSchema.name, adminContext.api)
    })
  }
}
