import type { DataContext } from './DataContext.ts'
import type { LoadingTracker } from './LoadingTracker.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type {
  FormNode,
  MenuNode,
  RouteState,
  ViewNode
} from './RouteTree.ts'

// The route of a view or form, which `useRouteContainer()` provides.
export interface RouteContext {
  readonly parent: RouteContext | null
  readonly dataContext: DataContext
  // Menus render the routes of their views through a view without data:
  readonly node: MenuNode | ViewNode | FormNode
  // The node of the route below, e.g. of a form that a tree renders:
  readonly childNode: MenuNode | ViewNode | FormNode | null
  readonly level: number
  readonly isForm: boolean
  readonly state: RouteState
  readonly path: string
  readonly isLastRoute: boolean
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
  getFormRoute(dataPath: string): { path: string; dataPath: string } | null
  getFormPath(dataPath: string): string | null
  getCreatePath(dataPath: string): string | null
  close(): Promise<boolean>
}
