import { shallowReactive, watch } from 'vue'
import { parseDataPath } from '@ditojs/utils'
import type { DataContext } from './DataContext.ts'
import type { RouteContext } from './RouteContext.ts'

export interface UiHandle {
  readonly dataContext: DataContext | null
  focus?(): void
}

export class UiRegistry {
  // The routes by level. Routes that are being left stay until they're
  // unmounted, or replaced by the ones of the new route:
  readonly routes = shallowReactive<RouteContext[]>([])
  // Reactive, so that lookups follow the components as they mount:
  readonly #handles = shallowReactive(new Map<string, Set<UiHandle>>())

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
    const stop = watch(getComponentPath, path => {
      this.#handles.get(componentPath)!.delete(handle)
      componentPath = add(path)
    })
    return () => {
      stop()
      this.#handles.get(componentPath)!.delete(handle)
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
