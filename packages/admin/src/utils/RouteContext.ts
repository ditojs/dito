import type { DataContext } from './DataContext.ts'
import type { LoadingTracker } from './LoadingTracker.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { MenuNode, ViewNode } from './RouteTree.ts'
import type { Schema } from './types.ts'

// Where the item of a form is in the data of its parent route. `key` is `null`
// for new items of lists:
export interface ItemLocation {
  dataPath: string
  componentPath: string
  data: any
  key: string | number | null
}

// The form that a route opens for an item of a source, which the source claims
// in the path below the route.
export interface RouteClaim {
  // The source of the item, e.g. the children of a tree:
  readonly schema: Schema
  // The path of the form, and the path of its source, which the forms of the
  // other items continue with their keys:
  readonly path: string
  readonly sourcePath: string
  // The id or index of the item, `create`, or `null` for objects:
  readonly param: string | null
  readonly location: ItemLocation
  readonly source: SourceContext
  // Trees render the forms of their items inside of them:
  readonly isEmbedded: boolean
  // The forms of the items of the same source share their component:
  readonly key: string
  // The claim of the form of `item`, which may have moved in the data:
  claimItem(item: object): RouteClaim | null
}

// The route of a view or form, which `useRouteContainer()` provides.
export interface RouteContext {
  readonly parent: RouteContext | null
  readonly dataContext: DataContext
  // The node of views and menus, which render the routes of their views
  // through a view without data, `null` in forms:
  readonly node: MenuNode | ViewNode | null
  // The claim that opened the form:
  readonly claim: RouteClaim | null
  // The claim of the form below:
  readonly childClaim: RouteClaim | null
  readonly level: number
  readonly isForm: boolean
  readonly isTransient: boolean
  readonly path: string
  readonly isLastRoute: boolean
  // The route shows its components while it's the last route, or while the
  // form below is embedded in them:
  readonly isActive: boolean
  readonly isLeaving: boolean
  readonly isDirty: boolean
  readonly breadcrumb: string
  // The tab of the route's schema:
  selectedTab: string | null
  // The form of `useDitoForm()` in the route's components, whose changes and
  // item are the route's:
  componentForm: {
    readonly dataContext: DataContext
    readonly itemLabel: string | null
  } | null
  readonly verbs: Record<string, string>
  // The text of the label of the item that forms edit, `null` in views:
  readonly itemLabel: string | null
  // Views track the requests of their forms too:
  readonly loadingTracker: LoadingTracker
  // Forms without a resource of their own continue the one of their parent:
  readonly resourceContext: ResourceContext | null
  // The routes of the forms that the components at component paths open,
  // which the sources that render them build:
  getFormRoute(
    componentPath: string
  ): { path: string; componentPath: string } | null
  getFormPath(componentPath: string): string | null
  close(): Promise<boolean>
}
