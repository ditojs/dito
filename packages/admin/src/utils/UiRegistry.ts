import { nextTick, shallowReactive, watch } from 'vue'
import { asArray, parseDataPath } from '@ditojs/utils'
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

  // Follow the changes of the component paths, e.g. when list items move.
  // Sections register for the paths of the widgets that they contain:
  register(
    getComponentPaths: () => string | string[],
    handle: UiHandle
  ): () => void {
    const add = (componentPaths: string[]) => {
      for (const componentPath of componentPaths) {
        const handles = this.#handles.get(componentPath) ?? new Set()
        this.#handles.set(componentPath, handles.add(handle))
      }
      return componentPaths
    }
    const remove = (componentPaths: string[]) => {
      for (const componentPath of componentPaths) {
        this.#handles.get(componentPath)!.delete(handle)
      }
    }
    let componentPaths = add(asArray(getComponentPaths()))
    const stop = watch(
      () => asArray(getComponentPaths()),
      paths => {
        remove(componentPaths)
        componentPaths = add(paths)
      }
    )
    return () => {
      stop()
      remove(componentPaths)
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
