import { shallowReactive, watch } from 'vue'
import { parseDataPath } from '@ditojs/utils'
import type { DataContext } from './DataContext.ts'
import type { RouteClaim, RouteContext, TabClaim } from './RouteContext.ts'

export interface UiHandle {
  readonly dataContext: DataContext | null
  focus?(): void
  // The form that the route's `path` opens, if this component claims it, e.g.
  // a source for the form of one of its items, or the tab that it names in a
  // schema:
  claimRoute?(path: string): RouteClaim | TabClaim | null
  // The route of the form that shows the component at `componentPath` inside
  // this one, with the component path within the form:
  getFormRoute?(
    componentPath: string
  ): { path: string; componentPath: string } | null
}

export class UiRegistry {
  // The routes by level. Routes that are being left stay until they're
  // unmounted, or replaced by the ones of the new route:
  readonly routes = shallowReactive<RouteContext[]>([])
  // Reactive, as form routes follow the components at their paths:
  readonly #handles = shallowReactive(new Map<string, Set<UiHandle>>())
  // The handles that claim routes, apart, so that the many components that
  // can't claim don't change the claims when they mount:
  readonly #claimants = shallowReactive(new Set<UiHandle>())

  // Follow the changes of the component path, e.g. when list items move:
  register(getComponentPath: () => string, handle: UiHandle): () => void {
    const add = (componentPath: string) => {
      const handles = (
        this.#handles.get(componentPath) ??
        shallowReactive(new Set<UiHandle>())
      )
      this.#handles.set(componentPath, handles.add(handle))
      return componentPath
    }
    let componentPath = add(getComponentPath())
    if (handle.claimRoute) {
      this.#claimants.add(handle)
    }
    const stop = watch(getComponentPath, path => {
      this.#handles.get(componentPath)!.delete(handle)
      componentPath = add(path)
    })
    return () => {
      stop()
      this.#handles.get(componentPath)!.delete(handle)
      this.#claimants.delete(handle)
    }
  }

  // In the order the components were created, the outer ones first:
  getHandles(
    componentPath: string,
    dataContext?: DataContext | null
  ): UiHandle[] {
    const handles = [...(this.#handles.get(componentPath) ?? [])]
    return dataContext === undefined
      ? handles
      : handles.filter(handle => handle.dataContext === dataContext)
  }

  // The first component that claims the route's `path`, in the order the
  // components were created:
  claimRoute(
    dataContext: DataContext,
    path: string
  ): RouteClaim | TabClaim | null {
    for (const handle of this.#claimants) {
      const claim =
        handle.dataContext === dataContext ? handle.claimRoute!(path) : null
      if (claim) return claim
    }
    return null
  }

  // Ask the components on the way from the outside in:
  getFormRoute(dataContext: DataContext, componentPath: string) {
    const parts = parseDataPath(componentPath)
    for (let index = 0; index <= parts.length; index++) {
      const path = parts.slice(0, index).join('/')
      for (const handle of this.getHandles(path, dataContext)) {
        const route = handle.getFormRoute?.(componentPath)
        if (route) return route
      }
    }
    return null
  }

  // Focus the revealed component at `componentPath`. Paths inside values that
  // no deeper component displays focus the component of the value:
  focus(dataContext: DataContext, componentPath: string) {
    const parts = parseDataPath(componentPath)
    for (let index = parts.length; index > 0; index--) {
      const path = parts.slice(0, index).join('/')
      const handle = this.getHandles(path, dataContext).find(
        handle => !!handle.focus
      )
      if (handle) {
        handle.focus!()
        break
      }
    }
  }
}
