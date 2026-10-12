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

  // Ask the components on the way from the outside in:
  async reveal(
    dataContext: DataContext | null,
    componentPath: string,
    { focus = false } = {}
  ) {
    const parts = parseDataPath(componentPath)
    for (let index = 0; index <= parts.length; index++) {
      const path = parts.slice(0, index).join('/')
      for (const handle of this.getHandles(path, dataContext)) {
        await handle.reveal?.(componentPath, { focus })
      }
    }
    if (focus) {
      await nextTick()
      const handle = this.getHandles(componentPath, dataContext).find(
        handle => !!handle.focus
      )
      handle?.focus!()
    }
  }
}
