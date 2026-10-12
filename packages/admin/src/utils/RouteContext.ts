import { shallowReactive } from 'vue'
import type { RouteRecordNormalized, Router } from 'vue-router'
import { getRelativeDataPath } from './data.js'
import {
  FormNode,
  type MenuNode,
  type RouteState,
  type SourceNode,
  type ViewNode
} from './RouteTree.ts'
import type { ContainerContext } from './ContainerContext.ts'
import type { LoadingTracker } from './LoadingTracker.ts'
import type { ResourceContext } from './ResourceContext.ts'
import type { SourceContext } from './SourceContext.ts'
import type { Schema } from './types.ts'

export interface RouteOwner {
  readonly routeRecord: RouteRecordNormalized
  readonly routeParams: Record<string, any>
  readonly schema: Schema | null
  readonly data: any
  readonly dataPath: string
  readonly rootData: Record<string, any> | null
  readonly componentPath: string
  readonly loadingTracker: LoadingTracker
  readonly isTransient?: boolean
  readonly isCreating?: boolean
  readonly path: string
  readonly isLastRoute: boolean
  readonly isLeavingRoute: boolean
  readonly isDirty: boolean
  readonly breadcrumb: string
  readonly selectedTab?: string | null
  readonly ownResource?: ResourceContext | null
}

export class RouteContext {
  readonly parent: RouteContext | null
  readonly container: ContainerContext
  // The responses of `request({ cache: 'local' })`, released with the route:
  readonly loadCache: Record<string, Promise<unknown>> = {}
  readonly #owner: RouteOwner
  readonly #router: Router
  readonly #sources = shallowReactive(new Set<SourceContext>())

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
    return this.#owner.routeRecord.meta.node!
  }

  get schema(): Schema | null {
    return this.#owner.schema
  }

  get dataPath(): string {
    return this.#owner.dataPath
  }

  get rootData(): Record<string, any> | null {
    return this.#owner.rootData
  }

  get componentPath(): string {
    return this.#owner.componentPath
  }

  // Views track the requests of their forms too:
  get loadingTracker(): LoadingTracker {
    return this.isForm
      ? this.parent!.loadingTracker
      : this.#owner.loadingTracker
  }

  get level(): number {
    return this.parent ? this.parent.level + 1 : 0
  }

  get isForm(): boolean {
    return this.node instanceof FormNode
  }

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

  get isLeaving(): boolean {
    return this.#owner.isLeavingRoute
  }

  get isDirty(): boolean {
    return this.#owner.isDirty
  }

  get breadcrumb(): string {
    return this.#owner.breadcrumb
  }

  get selectedTab(): string | null {
    return this.#owner.selectedTab ?? null
  }

  get resource(): ResourceContext | null {
    return this.#owner.ownResource ?? null
  }

  getFormRoute(dataPath: string): { path: string; dataPath: string } | null {
    const path = getRelativeDataPath(dataPath, this.dataPath)
    // Only views and forms render data, menus don't:
    const node = this.node as ViewNode | FormNode
    const route = path !== null && node.getFormRoute(path, this.state)
    return route
      ? { path: this.#router.resolve(route).path, dataPath: route.dataPath }
      : null
  }

  getFormPath(dataPath: string): string | null {
    const route = this.getFormRoute(dataPath)
    return route && !route.dataPath ? route.path : null
  }

  getCreatePath(dataPath: string): string | null {
    const path = getRelativeDataPath(dataPath, this.dataPath)
    const node = this.node as ViewNode | FormNode
    const route = path !== null && node.getCreateRoute(path, this.state)
    return route ? this.#router.resolve(route).path : null
  }

  registerSource(source: SourceContext, add: boolean) {
    if (add) {
      this.#sources.add(source)
    } else {
      this.#sources.delete(source)
    }
  }

  findSource(node: SourceNode): SourceContext | null {
    return [...this.#sources].find(source => source.node === node) ?? null
  }

  findSourceByDataPath(dataPath: string): SourceContext | null {
    return (
      [...this.#sources].find(source => source.dataPath === dataPath) ?? null
    )
  }

  close() {
    if (!this.parent) {
      throw new Error('Unable to close the route: Views cannot be closed.')
    }
    return this.#router.push(this.parent.path)
  }
}
