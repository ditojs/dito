import { computed, inject, provide, reactive } from 'vue'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'

export interface ComponentPath {
  readonly path: string
  // The data path that `path` corresponds to, `null` above the views:
  readonly dataPath: string | null
}

// The path of component names through views, tabs, panels and forms, with the
// item indices of the data path, e.g. `main/chapters/0/title`, which tells
// apart components that display the same data, for the UI registry and DOM
// ids. Components continue the path of their parent with the item indices that
// their data path adds, unless `getPath()` builds their own.
export function useComponentPath(
  getDataPath: () => string,
  getPath: (parent: ComponentPath) => string = parent =>
    continueComponentPath(parent, getDataPath())
) {
  const parent = inject<ComponentPath>('componentPath', {
    path: '',
    dataPath: null
  })
  const componentPath = computed(() => getPath(parent))
  provide(
    'componentPath',
    reactive({ path: componentPath, dataPath: computed(getDataPath) })
  )
  return { componentPath, parentComponentPath: computed(() => parent.path) }
}

export function continueComponentPath(
  parent: ComponentPath,
  dataPath: string
): string {
  const relativeDataPath = getRelativeDataPath(dataPath, parent.dataPath)
  return relativeDataPath
    ? appendDataPath(parent.path, relativeDataPath)
    : parent.path
}
