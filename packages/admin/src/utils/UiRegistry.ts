import { nextTick, shallowReactive, watch } from 'vue'
import { parseDataPath } from '@ditojs/utils'
import type { DataContext } from './DataContext.ts'
import type { RouteContext } from './RouteContext.ts'

export interface UiHandle {
  readonly dataContext: DataContext | null
  // Render what leads to the component at `componentPath` inside this one, e.g.
  // open a collapsed schema and render its tab, which `focus` also selects:
  reveal?(componentPath: string, options: { focus: boolean }): Promise<void>
  focus?(): void
  // The component path at which the component can display the errors at
  // `dataPath`, if it can, e.g. its own, or the one of a field in the form of
  // an item of a routed source:
  getErrorComponentPath?(dataPath: string): string | null
}

export class UiRegistry {
  // The routes by level. Routes that are being left stay until they're
  // unmounted, or replaced by the ones of the new route:
  readonly routes = shallowReactive<RouteContext[]>([])
  readonly #handles = new Map<string, Set<UiHandle>>()

  // Follow the changes of the component path, e.g. when list items move:
  register(getComponentPath: () => string, handle: UiHandle): () => void {
    const add = (componentPath: string) => {
      const handles = this.#handles.get(componentPath) ?? new Set()
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

  // The paths at which components can display the errors at `dataPath`, in
  // the order the components were created:
  getErrorComponentPaths(
    dataContext: DataContext,
    dataPath: string
  ): string[] {
    const componentPaths = new Set<string>()
    for (const handles of this.#handles.values()) {
      for (const handle of handles) {
        const componentPath =
          handle.dataContext === dataContext
            ? (handle.getErrorComponentPath?.(dataPath) ?? null)
            : null
        if (componentPath !== null) {
          componentPaths.add(componentPath)
        }
      }
    }
    return [...componentPaths]
  }

  // Ask the components on the way from the outside in:
  async reveal(
    dataContext: DataContext | null,
    componentPath: string,
    { focus = false } = {}
  ) {
    const parts = parseDataPath(componentPath)
    for (let index = 0; index <= parts.length; index++) {
      const path = parts.slice(0, index).join('/')
      // Also ask the components that the revealed ones mount at the same path,
      // e.g. nested sections:
      const asked = new Set<UiHandle>()
      const getNextHandle = () =>
        this.getHandles(path, dataContext).find(handle => !asked.has(handle))
      for (let handle = getNextHandle(); handle; handle = getNextHandle()) {
        asked.add(handle)
        await handle.reveal?.(componentPath, { focus })
      }
    }
    if (focus) {
      await nextTick()
      // Paths inside values that no deeper component displays focus the
      // component of the value:
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
}
