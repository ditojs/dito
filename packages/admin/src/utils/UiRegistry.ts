import { nextTick, shallowReactive, watch } from 'vue'
import { parseDataPath } from '@ditojs/utils'
import type { ContainerContext } from './ContainerContext.ts'
import type { RouteContext } from './RouteContext.ts'

// What a rendered component offers to reveal and focus it, e.g. to show errors.
export interface UiHandle {
  // The context of the data that the component displays:
  readonly container: ContainerContext | null
  // Render what leads to the component at `componentPath` inside this one, e.g.
  // open a collapsed schema and render its tab, which `focus` also selects:
  reveal?(componentPath: string, options: { focus: boolean }): Promise<void>
  // Focus the element of the component, once it's revealed:
  focus?(): void
}

// The handles of the rendered components by component path, and the contexts
// of the rendered routes.
export class UiRegistry {
  // The contexts of the routes by level. Routes that are being left stay until
  // they're unmounted, or replaced by the ones of the new route:
  readonly routes = shallowReactive<RouteContext[]>([])
  readonly #handles = new Map<string, Set<UiHandle>>()

  // Register `handle` under the component path, and again under the new one
  // whenever it changes, e.g. when list items move. Return the function that
  // unregisters it:
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

  // Return the handles at `componentPath`, of all containers or of `container`,
  // in the order the components were created, the outer ones first:
  getHandles(
    componentPath: string,
    container?: ContainerContext | null
  ): UiHandle[] {
    const handles = [...(this.#handles.get(componentPath) ?? [])]
    return container === undefined
      ? handles
      : handles.filter(handle => handle.container === container)
  }

  // Reveal the component at `componentPath` in `container`, by asking the
  // components on the way from the outside in, and with `focus`, focus it:
  async reveal(
    container: ContainerContext | null,
    componentPath: string,
    { focus = false } = {}
  ) {
    const parts = parseDataPath(componentPath)
    for (let index = 0; index <= parts.length; index++) {
      const path = parts.slice(0, index).join('/')
      for (const handle of this.getHandles(path, container)) {
        await handle.reveal?.(componentPath, { focus })
      }
    }
    if (focus) {
      await nextTick()
      const handle = this.getHandles(componentPath, container).find(
        handle => !!handle.focus
      )
      handle?.focus!()
    }
  }
}
