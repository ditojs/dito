import type { RouteRecordNormalized, Router } from 'vue-router'
import { getRelativeDataPath } from './data.js'
import {
  FormNode,
  type MenuNode,
  type RouteState,
  type ViewNode
} from './RouteTree.ts'
import type { ContainerContext } from './ContainerContext.ts'

// The view or form that renders a route.
export interface RouteOwner {
  readonly routeRecord: RouteRecordNormalized
  readonly routeParams: Record<string, any>
  readonly data: any
  readonly isTransient?: boolean
  readonly isCreating?: boolean
  readonly path: string
  readonly isLastRoute: boolean
  readonly mainSchemaComponent?: { selectedTab: string | null }
}

// The context of a view or form, provided to the components that it renders,
// with its location in the route tree.
export class RouteContext {
  readonly parent: RouteContext | null
  readonly container: ContainerContext
  // The responses of `request({ cache: 'local' })` of the components that the
  // route renders, released with it, see `DitoMixin.request()`:
  readonly loadCache: Record<string, Promise<unknown>> = {}
  readonly #owner: RouteOwner
  readonly #router: Router

  constructor(
    owner: RouteOwner,
    {
      parent,
      container,
      router
    }: {
      parent: RouteContext | null
      container: ContainerContext
      router: Router
    }
  ) {
    this.#owner = owner
    this.parent = parent
    this.container = container
    this.#router = router
  }

  // Menus render the routes of their views through a view without data:
  get node(): MenuNode | ViewNode | FormNode {
    return this.#owner.routeRecord.meta.node as MenuNode | ViewNode | FormNode
  }

  get level(): number {
    return this.parent ? this.parent.level + 1 : 0
  }

  get isForm(): boolean {
    return this.node instanceof FormNode
  }

  // The state that the routes below this one depend on, see `RouteTree`:
  get state(): RouteState {
    const { data, routeParams, isTransient, isCreating } = this.#owner
    return { data, routeParams, isTransient: !!(isTransient || isCreating) }
  }

  get path(): string {
    return this.#owner.path
  }

  get isLastRoute(): boolean {
    return this.#owner.isLastRoute
  }

  get selectedTab(): string | null {
    return this.#owner.mainSchemaComponent?.selectedTab ?? null
  }

  // Resolve the path of the deepest form that edits the data at `dataPath`,
  // along with the data path that remains within that form:
  getFormRoute(dataPath: string): { path: string; dataPath: string } | null {
    const path = getRelativeDataPath(dataPath, this.container.dataPath)
    const route = path !== null && this.#dataNode.getFormRoute(path, this.state)
    return route
      ? { path: this.#router.resolve(route).path, dataPath: route.dataPath }
      : null
  }

  // Resolve the path of the form that creates an item of the source at
  // `dataPath`:
  getCreatePath(dataPath: string): string | null {
    const path = getRelativeDataPath(dataPath, this.container.dataPath)
    const route = (
      path !== null &&
      this.#dataNode.getCreateRoute(path, this.state)
    )
    return route ? this.#router.resolve(route).path : null
  }

  // Only views and forms render data, menus don't:
  get #dataNode() {
    return this.node as ViewNode | FormNode
  }

  // Close the form, by navigating to the route of its parent:
  close() {
    if (!this.parent) {
      throw new Error('Unable to close the route: Views cannot be closed.')
    }
    return this.#router.push(this.parent.path)
  }
}
